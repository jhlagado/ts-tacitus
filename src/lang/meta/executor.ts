import { SyntaxError, Tag, fromTaggedValue, RSTACK_BASE_CELLS, STACK_BASE_CELLS } from '@src/core';
import { SEG_CODE } from '@src/core/constants';
import type { Op } from '../../ops/opcodes';
import { executeOp } from '../../ops/builtins';
import { evalOp } from '../../ops/core';
import type { VM } from '../../core/vm';
import type { Tokenizer } from '../tokenizer';
import type { ActiveDefinition } from '../state';
// SymbolTableEntry interface moved inline (symbol table removed)
type SymbolTableEntry = {
  taggedValue: number;
  isImmediate: boolean;
}
import { nextOpcode, rdepth, getStackData, rpush } from '../../core/vm';
import {
  beginDefinitionImmediate,
  beginIfImmediate,
  beginElseImmediate,
  beginWhenImmediate,
  beginDoImmediate,
  beginCaseImmediate,
  clauseOfImmediate,
  defaultImmediate,
  nilImmediate,
  beginCapsuleImmediate,
} from './index';

export function executeImmediateWord(
  vm: VM,
  name: string,
  entry: SymbolTableEntry,
  tokenizer: Tokenizer,
  currentDefinition: { current: ActiveDefinition | null },
): void {
  const { tag, value } = fromTaggedValue(entry.taggedValue);

  if (tag === Tag.BUILTIN) {
    // Dispatch known meta-immediate words by name (compile-time actions)
    switch (name) {
      case ':':
        beginDefinitionImmediate(vm, tokenizer, currentDefinition);
        return;
      case 'if':
        beginIfImmediate(vm, tokenizer, currentDefinition);
        return;
      case ';':
        if (vm.sp - STACK_BASE_CELLS === 0) {
          throw new SyntaxError('Unexpected semicolon', getStackData(vm));
        }
        evalOp(vm);
        return;
      case 'else':
        beginElseImmediate(vm, tokenizer, currentDefinition);
        return;
      case 'when':
        beginWhenImmediate(vm, tokenizer, currentDefinition);
        return;
      case 'do':
        beginDoImmediate(vm, tokenizer, currentDefinition);
        return;
      case 'case':
        beginCaseImmediate(vm, tokenizer, currentDefinition);
        return;
      case 'of':
        clauseOfImmediate(vm, tokenizer, currentDefinition);
        return;
      case 'DEFAULT':
        defaultImmediate(vm, tokenizer, currentDefinition);
        return;
      case 'NIL':
        nilImmediate(vm, tokenizer, currentDefinition);
        return;
      case 'capsule':
        beginCapsuleImmediate(vm, tokenizer, currentDefinition);
        return;
      default:
        // Immediate builtin with runtime semantics (e.g., immdup)
        executeOp(vm, value as Op);
        return;
    }
  }

  if (tag === Tag.CODE) {
    runImmediateCode(vm, value);
    return;
  }

  throw new SyntaxError(`Immediate word ${name} is not executable`, getStackData(vm));
}

export function runImmediateCode(vm: VM, address: number): void {
  const savedIP = vm.IP;
  const savedBP = vm.bp;
  const savedRSPRel = rdepth(vm);
  const savedRunning = vm.running;
  const savedCP = vm.compiler.CP;
  const savedBCP = vm.compiler.BCP;
  const savedPreserve = vm.compiler.preserve;

  rpush(vm, savedIP);
  // Save BP (relative cells) and set new frame
  rpush(vm, vm.bp - RSTACK_BASE_CELLS);
  vm.bp = vm.rsp;
  vm.IP = address;
  vm.running = true;

  while (vm.running) {
    const firstByte = vm.memory.read8(SEG_CODE, vm.IP);
    const isUserDefined = (firstByte & 0x80) !== 0;
    const opcode = nextOpcode(vm);
    executeOp(vm, opcode as Op, isUserDefined);
    if (vm.IP === savedIP && rdepth(vm) === savedRSPRel) {
      break;
    }
  }

  vm.running = savedRunning;
  vm.IP = savedIP;
  vm.bp = savedBP;
  vm.compiler.CP = savedCP;
  vm.compiler.BCP = savedBCP;
  vm.compiler.preserve = savedPreserve;
}
