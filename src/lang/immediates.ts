import { NestedDefinitionError, SyntaxError, UnclosedDefinitionError, Tag, fromTaggedValue, toTaggedValue } from '@src/core';
import { SEG_CODE } from '@src/core/constants';
import { vm } from './runtime';
import { TokenType } from './tokenizer';
import { Op } from '../ops/opcodes';
import type { ParserState, ActiveDefinition } from './state';
import { createBuiltinRef } from '../core/code-ref';
import { executeOp } from '../ops/builtins';
import type { SymbolTableEntry } from '../strings/symbol-table';
import { setEndDefinitionHandler } from './compiler-hooks';
import { requireParserState } from './state';

const ENDDEF_CODE_REF = createBuiltinRef(Op.EndDefinition);
const ENDIF_CODE_REF = createBuiltinRef(Op.EndIf);

setEndDefinitionHandler(() => endDefinition(requireParserState()));

export function beginDefinitionImmediate(): void {
  const state = requireParserState();
  beginDefinition(state);
  vm.push(ENDDEF_CODE_REF);
}

function patchPlaceholder(rawPos: number, word: string): void {
  if (!Number.isFinite(rawPos)) {
    throw new SyntaxError(`${word} missing branch placeholder`, vm.getStackData());
  }

  const branchPos = Math.trunc(rawPos);
  if (branchPos < 0) {
    throw new SyntaxError(`${word} invalid branch placeholder`, vm.getStackData());
  }

  const endAddress = vm.compiler.CP;
  const branchOffset = endAddress - (branchPos + 2);

  const prevCP = vm.compiler.CP;
  vm.compiler.CP = branchPos;
  vm.compiler.compile16(branchOffset);
  vm.compiler.CP = prevCP;
}

export function beginIfImmediate(): void {
  vm.compiler.compileOpcode(Op.IfFalseBranch);
  const falseBranchPos = vm.compiler.CP;
  vm.compiler.compile16(0);

  vm.push(falseBranchPos);
  vm.push(ENDIF_CODE_REF);
}

export function beginElseImmediate(): void {
  if (vm.SPCells < 2) {
    throw new SyntaxError('ELSE without IF', vm.getStackData());
  }

  const closer = vm.pop();
  const closerInfo = fromTaggedValue(closer);
  if (closerInfo.tag !== Tag.BUILTIN || closerInfo.value !== Op.EndIf) {
    throw new SyntaxError('ELSE without IF', vm.getStackData());
  }

  if (vm.SPCells === 0) {
    throw new SyntaxError('ELSE without IF', vm.getStackData());
  }

  const placeholder = vm.pop();

  vm.compiler.compileOpcode(Op.Branch);
  const exitBranchPos = vm.compiler.CP;
  vm.compiler.compile16(0);

  patchPlaceholder(placeholder, 'ELSE');

  vm.push(exitBranchPos);
  vm.push(closer);
}

export function executeImmediateWord(name: string, entry: SymbolTableEntry): void {
  if (entry.implementation) {
    entry.implementation(vm);
    return;
  }

  const { tag, value } = fromTaggedValue(entry.taggedValue);

  if (tag === Tag.BUILTIN) {
    executeOp(vm, value as Op);
    return;
  }

  if (tag === Tag.CODE) {
    runImmediateCode(value);
    return;
  }

  throw new SyntaxError(`Immediate word ${name} is not executable`, vm.getStackData());
}

export function runImmediateCode(address: number): void {
  const savedIP = vm.IP;
  const savedBPCells = vm.BPCells;
  const savedRSP = vm.RSP;
  const savedRunning = vm.running;
  const savedCP = vm.compiler.CP;
  const savedBCP = vm.compiler.BCP;
  const savedPreserve = vm.compiler.preserve;

  vm.rpush(toTaggedValue(savedIP, Tag.CODE));
  vm.rpush(vm.BPCells);
  vm.BPCells = vm.RSP;
  vm.IP = address;
  vm.running = true;

  while (vm.running) {
    const firstByte = vm.memory.read8(SEG_CODE, vm.IP);
    const isUserDefined = (firstByte & 0x80) !== 0;
    const opcode = vm.nextOpcode();
    executeOp(vm, opcode as Op, isUserDefined);
    if (vm.IP === savedIP && vm.RSP === savedRSP) {
      break;
    }
  }

  vm.running = savedRunning;
  vm.IP = savedIP;
  vm.BPCells = savedBPCells;
  vm.compiler.CP = savedCP;
  vm.compiler.BCP = savedBCP;
  vm.compiler.preserve = savedPreserve;
}

export function beginDefinition(state: ParserState): void {
  if (state.insideCodeBlock) {
    throw new NestedDefinitionError(vm.getStackData());
  }

  if (state.currentDefinition) {
    throw new NestedDefinitionError(vm.getStackData());
  }

  const nameToken = state.tokenizer.nextToken();
  if (nameToken.type !== TokenType.WORD && nameToken.type !== TokenType.NUMBER) {
    throw new SyntaxError('Expected word name after :', vm.getStackData());
  }

  const wordName = String(nameToken.value);

  if (wordName === ':' || wordName === ';') {
    throw new SyntaxError('Expected word name after :', vm.getStackData());
  }

  vm.compiler.compileOpcode(Op.Branch);
  const branchPos = vm.compiler.CP;
  vm.compiler.compile16(0);

  const checkpoint = vm.symbolTable.mark();
  const definition: ActiveDefinition = {
    name: wordName,
    branchPos,
    checkpoint,
  };
  state.currentDefinition = definition;

  vm.compiler.preserve = true;
  vm.compiler.enterFunction();
}

export function endDefinition(state: ParserState): void {
  if (!state.currentDefinition) {
    throw new SyntaxError('Unexpected semicolon', vm.getStackData());
  }

  vm.compiler.compileOpcode(Op.Exit);
  vm.compiler.exitFunction();

  patchBranchOffset(state.currentDefinition.branchPos);

  const { name, branchPos } = state.currentDefinition;
  const defStart = branchPos + 2;
  vm.symbolTable.defineCode(name, defStart);

  state.currentDefinition = null;
}

export function ensureNoOpenDefinition(state: ParserState): void {
  if (state.currentDefinition) {
    throw new UnclosedDefinitionError(state.currentDefinition.name, vm.getStackData());
  }
}

export function patchBranchOffset(branchPos: number): void {
  const endAddress = vm.compiler.CP;
  const branchOffset = endAddress - (branchPos + 2);

  const prevCP = vm.compiler.CP;

  vm.compiler.CP = branchPos;
  vm.compiler.compile16(branchOffset);

  vm.compiler.CP = prevCP;
}
