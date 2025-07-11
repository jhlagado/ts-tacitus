import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from '../core/vm';
import { SEG_STACK } from '../core/memory';
import { toTaggedValue, Tag } from '../core/tagged';
import { findElement } from './find';

// Helper function to push a value onto the stack
function pushValue(vm: VM, value: number, tag: Tag = Tag.NUMBER): void {
  vm.memory.writeFloat32(SEG_STACK, vm.SP, toTaggedValue(value, tag));
  vm.SP += 4; // 4 bytes per element
}

// Helper function to create a simple tuple on the stack
function createSimpleTuple(vm: VM, ...values: number[]): { start: number; end: number } {
  const start = vm.SP;
  
  // Push TUPLE tag with element count
  pushValue(vm, values.length, Tag.TUPLE);
  
  // Push all values
  values.forEach(val => pushValue(vm, val));
  
  // Push LINK tag with total element count (values + TUPLE tag)
  pushValue(vm, values.length + 1, Tag.LINK);
  
  return {
    start,
    end: vm.SP
  };
}

describe('findElement', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  test('should find elements in sequence', () => {
    // Create a stack with: [TUPLE 2, 1, 2, LINK 3, 42, 43]
    createSimpleTuple(vm, 1, 2);
    pushValue(vm, 42);
    pushValue(vm, 43);

    // Find first element (43)
    const [offset1, size1] = findElement(vm, 0);
    expect(offset1).toBe(1);
    expect(size1).toBe(1);

    // Find second element (42)
    const [offset2, size2] = findElement(vm, offset1);
    expect(offset2).toBe(2);
    expect(size2).toBe(1);

    // Find the tuple
    const [offset3, size3] = findElement(vm, offset2);
    expect(offset3).toBe(6); // 2 + 4 slots for the tuple
    expect(size3).toBe(4);   // TUPLE + 1 + 2 + LINK
  });

  test('should handle tuple at TOS', () => {
    // Create a stack with: [TUPLE 2, 1, 2, LINK 3]
    createSimpleTuple(vm, 1, 2);

    // Find the tuple
    const [nextSlot, size] = findElement(vm, 0);
    expect(size).toBe(4); // TUPLE + 1 + 2 + LINK
    expect(nextSlot).toBe(4); // 4 slots total
  });

  test('should handle multiple tuples', () => {
    // Create a stack with: [TUPLE 1, 1, LINK 2, TUPLE 2, 3, 4, LINK 3]
    createSimpleTuple(vm, 3, 4);
    createSimpleTuple(vm, 1);

    // Find first tuple
    const [offset1, size1] = findElement(vm, 0);
    expect(size1).toBe(3); // TUPLE + 1 + LINK

    // Find second tuple
    const [_offset2, size2] = findElement(vm, offset1);
    expect(size2).toBe(4); // TUPLE + 3 + 4 + LINK
  });
});
