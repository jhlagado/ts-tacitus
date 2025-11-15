import { SyntaxError, Tag, getTaggedInfo, RSTACK_BASE, STACK_BASE } from '@src/core';
import { SEG_CODE } from '@src/core/constants';
import type { Op } from '../../ops/opcodes';
import { executeOp } from '../../ops/builtins';
import { evalOp } from '../../ops/core';
import { nextOpcode, rdepth, getStackData, rpush } from '../../core/vm';
import type { VM } from '../../core/vm';
import { decodeX1516 } from '../../core/code-ref';
import type { Tokenizer } from '../tokenizer';
// SymbolTableEntry interface moved inline (symbol table removed)
type SymbolTableEntry = {
  taggedValue: number;
  isImmediate: boolean;
};
import { defaultImmediate, nilImmediate } from './case';

export type ImmediateHandler = (vm: VM, tokenizer: Tokenizer) => void;

const immediateHandlers = new Map<number, ImmediateHandler>();

export function registerImmediateHandler(opcode: number, handler: ImmediateHandler): void {
  immediateHandlers.set(opcode, handler);
}

export function resetImmediateHandlers(): void {
  immediateHandlers.clear();
}
export function semicolonImmediate(vm: VM, _tokenizer: Tokenizer): void {
  if (vm.sp - STACK_BASE === 0) {
    throw new SyntaxError('Unexpected semicolon', getStackData(vm));
  }
  evalOp(vm);
}

/**
 * Executes an immediate word during parsing.
 * Immediate words execute at compile time rather than runtime.
 * @param vm - VM instance
 * @param name - Name of the immediate word
 * @param entry - Symbol table entry for the word
 * @param tokenizer - Tokenizer instance
 */
export function executeImmediateWord(
  vm: VM,
  name: string,
  entry: SymbolTableEntry,
  tokenizer: Tokenizer,
): void {
  const { tag, value } = getTaggedInfo(entry.taggedValue);

  if (tag === Tag.CODE) {
    // If encoded value < 128, it's invalid X1516 format, so treat as builtin immediate word
    if (value < 128) {
      const opcode = value as Op;
      const handler = immediateHandlers.get(opcode);
      if (name === 'DEFAULT') {
        defaultImmediate(vm, tokenizer);
        return;
      }
      if (name === 'NIL') {
        nilImmediate(vm, tokenizer);
        return;
      }
      if (handler) {
        handler(vm, tokenizer);
        return;
      }
      // Immediate builtin with runtime semantics (e.g., immdup)
      executeOp(vm, opcode);
      return;
    }
    // Otherwise, decode X1516 and run as immediate code block
    const decodedAddress = decodeX1516(value);
    runImmediateCode(vm, decodedAddress);
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
  rpush(vm, vm.bp - RSTACK_BASE);
  vm.bp = vm.rsp;
  vm.IP = address;
  vm.running = true;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
