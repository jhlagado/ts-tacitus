import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from '../../core/vm';
import { SEG_STACK } from '../../core/memory';
import { toTaggedValue, Tag } from '../../core/tagged';
import { findElement } from '../../ops/stack-utils';

const BYTES_PER_ELEMENT = 4;

describe('findElement', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
    // Initialize VM with a clean stack
    vm.SP = 0;
  });

  // Helper function to push a value onto the stack
  function pushValue(value: number, tag: Tag = Tag.NUMBER): void {
    vm.memory.writeFloat32(SEG_STACK, vm.SP, toTaggedValue(value, tag));
    vm.SP += BYTES_PER_ELEMENT;
  }

  // Helper function to create a simple tuple on the stack
  function createSimpleTuple(...values: number[]): void {
    // Push TUPLE tag with element count
    pushValue(values.length, Tag.TUPLE);

    // Push all values
    values.forEach(val => pushValue(val));

    // Push LINK tag with total element count
    pushValue(values.length + 1, Tag.LINK);
  }

  test('should find elements in sequence', () => {
    // Create a stack with: [TUPLE 2, 1, 2, LINK 3, 42, 43]
    createSimpleTuple(1, 2);
    pushValue(42);
    pushValue(43);

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
    createSimpleTuple(1, 2);

    // Find the tuple
    const [nextSlot, size] = findElement(vm, 0);
    expect(size).toBe(4); // TUPLE + 1 + 2 + LINK
    expect(nextSlot).toBe(4); // 4 slots total
  });

  test('should handle multiple tuples', () => {
    // Create a stack with: [TUPLE 1, 1, LINK 2, TUPLE 2, 3, 4, LINK 3]
    createSimpleTuple(3, 4);
    createSimpleTuple(1);

    // Find first tuple
    const [offset1, size1] = findElement(vm, 0);
    expect(size1).toBe(3); // TUPLE + 1 + LINK

    // Find second tuple
    const [_offset2, size2] = findElement(vm, offset1);
    expect(size2).toBe(4); // TUPLE + 3 + 4 + LINK
  });
});
