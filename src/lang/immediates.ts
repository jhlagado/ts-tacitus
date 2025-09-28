import { SyntaxError, Tag, fromTaggedValue, toTaggedValue } from '@src/core';
import { SEG_CODE } from '@src/core/constants';
import { createBuiltinRef } from '../core/code-ref';
import { Op } from '../ops/opcodes';
import { executeOp } from '../ops/builtins';
import type { SymbolTableEntry } from '../strings/symbol-table';
import { setEndDefinitionHandler } from './compiler-hooks';
import { beginDefinition, endDefinition } from './definitions';
import { requireParserState } from './state';
import { vm } from './runtime';

const ENDDEF_CODE_REF = createBuiltinRef(Op.EndDefinition);

setEndDefinitionHandler(() => endDefinition(requireParserState()));

export function beginDefinitionImmediate(): void {
  const state = requireParserState();
  beginDefinition(state);
  vm.push(ENDDEF_CODE_REF);
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
