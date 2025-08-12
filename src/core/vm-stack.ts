/**
 * @file src/core/vm-stack.ts
 * Stack operations for both data and return stacks.
 * Direct mapping target for C stack functions.
 */

import { VMCore, VMStack, VMResult } from './vm-types';
import { vmMemory } from './vm-memory';
import { STACK_SIZE, RSTACK_SIZE, SEG_STACK, SEG_RSTACK } from './constants';

/** Number of bytes per stack element (32-bit float) */
const BYTES_PER_ELEMENT = 4;

/**
 * Stack operations implementation
 * Direct mapping to C functions: vm_push, vm_pop, vm_peek, etc.
 */
export const vmStack: VMStack = {
  push(vm: VMCore, value: number): VMResult {
    if (vm.SP + BYTES_PER_ELEMENT > STACK_SIZE) {
      return VMResult.STACK_OVERFLOW;
    }
    
    vmMemory.writeFloat32(vm, SEG_STACK, vm.SP, value);
    vm.SP += BYTES_PER_ELEMENT;
    return VMResult.OK;
  },

  pop(vm: VMCore): [VMResult, number] {
    if (vm.SP <= 0) {
      return [VMResult.STACK_UNDERFLOW, 0];
    }
    
    vm.SP -= BYTES_PER_ELEMENT;
    const value = vmMemory.readFloat32(vm, SEG_STACK, vm.SP);
    return [VMResult.OK, value];
  },

  peek(vm: VMCore): [VMResult, number] {
    if (vm.SP <= 0) {
      return [VMResult.STACK_UNDERFLOW, 0];
    }
    
    const value = vmMemory.readFloat32(vm, SEG_STACK, vm.SP - BYTES_PER_ELEMENT);
    return [VMResult.OK, value];
  },

  popArray(vm: VMCore, size: number): [VMResult, number[]] {
    if (vm.SP < size * BYTES_PER_ELEMENT) {
      return [VMResult.STACK_UNDERFLOW, []];
    }
    
    // C-ready: Fixed-size buffer instead of dynamic array
    const MAX_POP_SIZE = 256; // Reasonable stack operation limit
    if (size > MAX_POP_SIZE) {
      return [VMResult.STACK_UNDERFLOW, []];
    }
    
    const result = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const [status, value] = vmStack.pop(vm);
      if (status !== VMResult.OK) {
        return [status, []];
      }
      result[size - 1 - i] = value; // Reverse order without unshift
    }
    
    return [VMResult.OK, Array.from(result)];
  },

  ensureSize(vm: VMCore, size: number): boolean {
    return vm.SP >= size * BYTES_PER_ELEMENT;
  },

  rpush(vm: VMCore, value: number): VMResult {
    if (vm.RP + BYTES_PER_ELEMENT > RSTACK_SIZE) {
      return VMResult.RETURN_STACK_OVERFLOW;
    }
    
    vmMemory.writeFloat32(vm, SEG_RSTACK, vm.RP, value);
    vm.RP += BYTES_PER_ELEMENT;
    return VMResult.OK;
  },

  rpop(vm: VMCore): [VMResult, number] {
    if (vm.RP <= 0) {
      return [VMResult.RETURN_STACK_UNDERFLOW, 0];
    }
    
    vm.RP -= BYTES_PER_ELEMENT;
    const value = vmMemory.readFloat32(vm, SEG_RSTACK, vm.RP);
    return [VMResult.OK, value];
  },

  getStackData(vm: VMCore): number[] {
    // C-ready: Fixed-size buffer approach
    const MAX_STACK_ELEMENTS = vm.SP / BYTES_PER_ELEMENT;
    const stackData = new Float32Array(MAX_STACK_ELEMENTS);
    let count = 0;
    
    for (let i = 0; i < vm.SP; i += BYTES_PER_ELEMENT) {
      stackData[count++] = vmMemory.readFloat32(vm, SEG_STACK, i);
    }
    
    return Array.from(stackData);
  }
};