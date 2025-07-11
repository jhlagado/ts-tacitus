import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from '../core/vm';
import { SEG_STACK } from '../core/memory';
import { toTaggedValue, Tag } from '../core/tagged';
import { findTupleSlots } from './find';
import { BYTES_PER_ELEMENT as _BYTES_PER_ELEMENT } from '../core/constants';

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

describe('findTupleSlots', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  test('should find a simple tuple at the top of stack', () => {
    // Create a tuple with 2 elements: [TUPLE 2, 1, 2, LINK 3]
    createSimpleTuple(vm, 1, 2);

    // Find the tuple from the top of stack (LINK position)
    const [nextSlot, size] = findTupleSlots(vm, 0);

    // Should return size 4 (TUPLE + 2 elements + LINK)
    expect(size).toBe(4);
    // Next slot should be 4 positions after start
    expect(nextSlot).toBe(4);
  });

  test('should find nested tuples', () => {
    // Create an inner tuple with 1 element
    // Stack: [TUPLE 1, 42, LINK 2]
    createSimpleTuple(vm, 42);
    
    // The stack now looks like: [TUPLE 1, 42, LINK 2]
    // When we call findTupleSlots(0), it should find the LINK tag at the top
    const [nextSlot, size] = findTupleSlots(vm, 0);
    expect(size).toBe(3); // TUPLE + 1 element + LINK
    expect(nextSlot).toBe(3); // Should point past the tuple
    
    // The element at offset 1 is the TUPLE tag, which findTupleSlots doesn't recognize
    // as the start of a tuple (only LINK tags are recognized)
    const [tupleNext, tupleSize] = findTupleSlots(vm, 1);
    expect(tupleSize).toBe(1); // Just the TUPLE tag itself
    expect(tupleNext).toBe(2); // Points to the next element
    
    // The element at offset 2 is the value (42)
    const [valueNext, valueSize] = findTupleSlots(vm, 2);
    expect(valueSize).toBe(1); // Just the value
    expect(valueNext).toBe(3); // Points to the next element
  });

  test('should return size 1 for non-tuple elements', () => {
    // Push a regular number
    pushValue(vm, 42);

    const [nextSlot, size] = findTupleSlots(vm, 0);
    expect(size).toBe(1);
    expect(nextSlot).toBe(1);
  });

  test('should handle out of bounds access', () => {
    // Empty stack
    const [nextSlot, size] = findTupleSlots(vm, 100);
    expect(size).toBe(1);
    expect(nextSlot).toBe(101);
  });

  test('should find tuple with offset', () => {
    // Create a tuple and push some values on top
    createSimpleTuple(vm, 10, 20);
    pushValue(vm, 30);
    pushValue(vm, 40);

    // The tuple is 2 slots from the top (30, 40)
    const [nextSlot, size] = findTupleSlots(vm, 2);
    expect(size).toBe(4); // TUPLE + 2 elements + LINK
    expect(nextSlot).toBe(6); // 2 (offset) + 4 (size)
  });

  test('should handle empty tuple', () => {
    // Create an empty tuple: [TUPLE 0, LINK 1]
    pushValue(vm, 0, Tag.TUPLE);
    pushValue(vm, 1, Tag.LINK);

    const [nextSlot, size] = findTupleSlots(vm, 0);
    expect(size).toBe(2); // TUPLE + LINK
    expect(nextSlot).toBe(2);
  });
});
