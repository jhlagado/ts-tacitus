import { SyntaxError, Tag, fromTaggedValue, RSTACK_BASE_CELLS } from '@src/core';
import { SEG_CODE } from '@src/core/constants';
import { Op } from '../../ops/opcodes';
import { executeOp } from '../../ops/builtins';
import type { SymbolTableEntry } from '../../strings/symbol-table';
import { vm } from '../runtime';

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
  const savedBP = vm.bp;
  const savedRSPRel = vm.rsp - RSTACK_BASE_CELLS;
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
    if (vm.IP === savedIP && (vm.rsp - RSTACK_BASE_CELLS) === savedRSPRel) {
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
