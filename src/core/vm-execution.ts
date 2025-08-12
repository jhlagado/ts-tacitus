/**
 * @file src/core/vm-execution.ts
 * Bytecode execution operations.
 * Direct mapping target for C execution functions.
 */

import { VMCore, VMExecution, VMResult } from './vm-types';
import { vmMemory } from './vm-memory';
import { vmStack } from './vm-stack';
import { SEG_CODE } from './constants';
import { fromTaggedValue, toTaggedValue, Tag } from './tagged';

/**
 * Bytecode execution implementation
 * Direct mapping to C functions: vm_next8, vm_next_opcode, etc.
 */
export const vmExecution: VMExecution = {
  next8(vm: VMCore): number {
    const value = vmMemory.read8(vm, SEG_CODE, vm.IP);
    vm.IP += 1;
    return value;
  },

  nextOpcode(vm: VMCore): number {
    const firstByte = vmMemory.read8(vm, SEG_CODE, vm.IP);
    vm.IP += 1;
    
    if ((firstByte & 0x80) !== 0) {
      const secondByte = vmMemory.read8(vm, SEG_CODE, vm.IP);
      vm.IP += 1;
      const lowBits = firstByte & 0x7f;
      const highBits = secondByte << 7;
      return highBits | lowBits;
    }
    
    return firstByte;
  },

  next16(vm: VMCore): number {
    const unsignedValue = vmMemory.read16(vm, SEG_CODE, vm.IP);
    const signedValue = (unsignedValue << 16) >> 16;
    vm.IP += 2;
    return signedValue;
  },

  nextFloat32(vm: VMCore): number {
    const value = vmMemory.readFloat32(vm, SEG_CODE, vm.IP);
    vm.IP += 4;
    return value;
  },

  nextAddress(vm: VMCore): number {
    const tagNum = vmExecution.nextFloat32(vm);
    const { value: pointer } = fromTaggedValue(tagNum);
    return pointer;
  },

  read16(vm: VMCore): number {
    const lowByte = vmMemory.read8(vm, SEG_CODE, vm.IP);
    const highByte = vmMemory.read8(vm, SEG_CODE, vm.IP + 1);
    vm.IP += 2;
    return (highByte << 8) | lowByte;
  },

  eval(vm: VMCore): VMResult {
    const result = vmStack.rpush(vm, toTaggedValue(vm.IP, Tag.CODE));
    if (result !== VMResult.OK) {
      return result;
    }
    
    const [popResult, value] = vmStack.pop(vm);
    if (popResult !== VMResult.OK) {
      return popResult;
    }
    
    const { value: pointer } = fromTaggedValue(value);
    vm.IP = pointer;
    return VMResult.OK;
  }
};