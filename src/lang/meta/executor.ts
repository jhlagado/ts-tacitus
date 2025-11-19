import { SyntaxError, RSTACK_BASE, STACK_BASE } from '@src/core';
import { SEG_CODE } from '@src/core/constants';
import { type Op } from '../../ops/opcodes';
import { executeOp } from '../../ops/builtins';
import { evalOp } from '../../ops/core';
import { nextOpcode, rdepth, getStackData, rpush } from '../../core/vm';
import type { VM } from '../../core/vm';

export function semicolonImmediateOp(vm: VM): void {
  if (vm.sp - STACK_BASE === 0) {
    throw new SyntaxError('Unexpected semicolon', getStackData(vm));
  }
  evalOp(vm);
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
