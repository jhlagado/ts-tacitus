import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from '../core/vm';
import { SEG_STACK } from '../core/memory';
import { toTaggedValue, Tag } from '../core/tagged';
import { findElement, findTupleSlots } from './find';

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

describe('findTuple', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  test('should find a simple tuple', () => {
    // Create a tuple with 2 elements: [TUPLE 2, 1, 2, LINK 3]
    createSimpleTuple(vm, 1, 2);

    // Find the tuple from the link position (top of stack)
    const [_nextSlot, size] = findTupleSlots(vm, 0);

    expect(size).toBe(4); // TUPLE + 1 + 2 + LINK = 4 slots
  });

  test('should return size 1 for non-tuple', () => {
    // Push some random values that don't form a valid tuple
    pushValue(vm, 42);
    pushValue(vm, 13);

    const [_, size] = findTupleSlots(vm, 0);
    expect(size).toBe(1);
  });

  test('should find nested tuples', () => {
    // Create an inner tuple: [TUPLE 2, 1, 2, LINK 3]
    createSimpleTuple(vm, 1, 2);

    // The inner tuple is now at the bottom of the stack
    // Let's verify we can find it directly
    const [_innerNext, innerSize] = findTupleSlots(vm, 0);
    expect(innerSize).toBe(4); // TUPLE + 1 + 2 + LINK = 4 slots

    // Now create an outer tuple that references the inner tuple
    pushValue(vm, 1, Tag.TUPLE); // Tuple with 1 element
    pushValue(vm, 4); // Push the inner tuple's size in slots
    pushValue(vm, 2, Tag.LINK); // Total elements: TUPLE(1) + 1 value + LINK = 3

    // Find the outer tuple
    const [_outerNext, outerSize] = findTupleSlots(vm, 0);
    expect(outerSize).toBe(3); // TUPLE + 1 element + LINK = 3 slots
  });

  test('should return size 1 when stack is empty', () => {
    const [_, size] = findTupleSlots(vm, 0);
    expect(size).toBe(1);
  });

  test('should return size 1 when element is not a tuple', () => {
    // Push a non-tuple value
    pushValue(vm, 42);

    const [_, size] = findTupleSlots(vm, 0);
    expect(size).toBe(1);
  });

  test('should find a tuple with offset from the top', () => {
    // Create a tuple: [TUPLE 2, 1, 2, LINK 3] (4 elements)
    createSimpleTuple(vm, 1, 2);

    // Push some values on top of the tuple
    pushValue(vm, 10);
    pushValue(vm, 20);

    // The tuple's LINK tag is at offset 2 slots (10 and 20) from the current SP
    const [_next, size] = findTupleSlots(vm, 2);

    expect(size).toBe(4); // TUPLE + 1 + 2 + LINK = 4 slots
  });

  test('should find an empty tuple', () => {
    // Create an empty tuple: [TUPLE 0, LINK 1]
    pushValue(vm, 0, Tag.TUPLE);
    pushValue(vm, 1, Tag.LINK);

    const [_next, size] = findTupleSlots(vm, 0);
    expect(size).toBe(2); // TUPLE + LINK = 2 slots
  });

  test('should return size 1 for invalid tuple structure (missing TUPLE tag)', () => {
    // Push just a LINK tag without TUPLE
    pushValue(vm, 1, Tag.LINK);

    const [_next, size] = findTupleSlots(vm, 0);
    expect(size).toBe(1);
  });

  test('should return size 1 for invalid tuple structure (size mismatch)', () => {
    // Create a tuple with mismatched sizes: TUPLE says 2 elements but LINK says 4
    pushValue(vm, 2, Tag.TUPLE); // Says 2 elements
    pushValue(vm, 1);
    pushValue(vm, 2);
    pushValue(vm, 4, Tag.LINK); // Says 4 total elements (should be 3 for 2 data elements)

    const [_next, size] = findTupleSlots(vm, 0);
    expect(size).toBe(1);
  });

  test('should handle out of bounds access', () => {
    // Try to access beyond stack bounds
    vm.SP = 0; // Empty stack
    const [_next1, size1] = findTupleSlots(vm, 0);
    expect(size1).toBe(1);

    // Try with negative offset
    const [_next2, size2] = findTupleSlots(vm, -1);
    expect(size2).toBe(1);

    // Try with offset beyond stack
    const largeOffset = 1000000;
    const [_next3, size3] = findTupleSlots(vm, largeOffset);
    expect(size3).toBe(1);
  });

  test('should find tuple after pushing other values', () => {
    // Create a simple tuple with 2 values
    createSimpleTuple(vm, 42, 100);

    // Push some other values on top
    pushValue(vm, 500);
    pushValue(vm, 600);

    // The tuple is 2 slots from the current SP (500, 600, and the tuple's LINK tag)
    // We're looking at the tuple's LINK tag which is 2 slots from the top
    const [_next, size] = findTupleSlots(vm, 2);
    expect(size).toBe(4); // TUPLE + 2 values + LINK = 4 slots
  });

  test('should handle maximum size tuple within limits', () => {
    // Use the maximum allowed size (16-bit unsigned integer)
    const maxSize = 10; // Using a smaller size for testing

    // Create a tuple
    pushValue(vm, maxSize, Tag.TUPLE);

    // Push elements
    for (let i = 0; i < maxSize; i++) {
      pushValue(vm, i % 1000); // Keep values within 16-bit range
    }

    // Push LINK tag
    pushValue(vm, maxSize + 1, Tag.LINK);

    const [_next, size] = findTupleSlots(vm, 0);
    expect(size).toBe(maxSize + 2); // TUPLE + elements + LINK
  });
});

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
