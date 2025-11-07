import { SyntaxError, Tag, fromTaggedValue, RSTACK_BASE_CELLS, STACK_BASE_CELLS } from '@src/core';
import { SEG_CODE } from '@src/core/constants';
import { Op } from '../../ops/opcodes';
import { executeOp } from '../../ops/builtins';
import { evalOp } from '../../ops/core';
// SymbolTableEntry interface moved inline (symbol table removed)
interface SymbolTableEntry {
  taggedValue: number;
  isImmediate: boolean;
}
import { vm } from '../runtime';
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

export function executeImmediateWord(name: string, entry: SymbolTableEntry): void {
  const { tag, value } = fromTaggedValue(entry.taggedValue);

  if (tag === Tag.BUILTIN) {
    // Dispatch known meta-immediate words by name (compile-time actions)
    switch (name) {
      case ':':
        beginDefinitionImmediate();
        return;
      case 'if':
        beginIfImmediate();
        return;
      case ';':
        if (vm.sp - STACK_BASE_CELLS === 0) {
          throw new SyntaxError('Unexpected semicolon', vm.getStackData());
        }
        evalOp(vm);
        return;
      case 'else':
        beginElseImmediate();
        return;
      case 'when':
        beginWhenImmediate();
        return;
      case 'do':
        beginDoImmediate();
        return;
      case 'case':
        beginCaseImmediate();
        return;
      case 'of':
        clauseOfImmediate();
        return;
      case 'DEFAULT':
        defaultImmediate();
        return;
      case 'NIL':
        nilImmediate();
        return;
      case 'capsule':
        beginCapsuleImmediate();
        return;
      default:
        // Immediate builtin with runtime semantics (e.g., immdup)
        executeOp(vm, value as Op);
        return;
    }
  }

  if (tag === Tag.CODE) {
    runImmediateCode(value);
    return;
  }

  throw new SyntaxError(`Immediate word ${name} is not executable`, vm.getStackData());
}

export function runImmediateCode(address: number): void {
  const savedIP = vm.IP;
  const savedBP = vm.bp;
  const savedRSPRel = vm.rdepth();
  const savedRunning = vm.running;
  const savedCP = vm.compiler.CP;
  const savedBCP = vm.compiler.BCP;
  const savedPreserve = vm.compiler.preserve;

  vm.rpush(savedIP);
  // Save BP (relative cells) and set new frame
  vm.rpush(vm.bp - RSTACK_BASE_CELLS);
  vm.bp = vm.rsp;
  vm.IP = address;
  vm.running = true;

  while (vm.running) {
    const firstByte = vm.memory.read8(SEG_CODE, vm.IP);
    const isUserDefined = (firstByte & 0x80) !== 0;
    const opcode = vm.nextOpcode();
    executeOp(vm, opcode as Op, isUserDefined);
    if (vm.IP === savedIP && vm.rdepth() === savedRSPRel) {
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
