import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from '../core/vm';
import { SEG_STACK } from '../core/memory';
import { toTaggedValue, Tag } from '../core/tagged';
import { findTuple } from './find';
import { BYTES_PER_ELEMENT } from '../core/constants';

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
    const { start, end } = createSimpleTuple(vm, 1, 2);

    // Find the tuple from the link position (top of stack)
    const result = findTuple(vm, 0);

    expect(result).not.toBeNull();
    expect(result?.start).toBe(start);
    expect(result?.end).toBe(end);
    expect(result?.size).toBe(2);
    expect(result?.totalSize).toBe(4 * 4); // 4 elements * 4 bytes each (TUPLE + 1 + 2 + LINK)
    expect(result?.linkOffset).toBe(3 * 4); // 3 elements * 4 bytes
  });

  test('should return null for invalid tuple', () => {
    // Push some random values that don't form a valid tuple
    pushValue(vm, 42);
    pushValue(vm, 13);

    const result = findTuple(vm, 0);
    expect(result).toBeNull();
  });

  test('should find nested tuples', () => {
    // Create an inner tuple: [TUPLE 2, 1, 2, LINK 3]
    const inner = createSimpleTuple(vm, 1, 2);

    // The inner tuple is now at the bottom of the stack
    // Let's verify we can find it directly
    const innerResult = findTuple(vm, 0);
    expect(innerResult).not.toBeNull();
    expect(innerResult?.size).toBe(2);

    // Now create an outer tuple that references the inner tuple
    pushValue(vm, 1, Tag.TUPLE); // Tuple with 1 element
    pushValue(vm, inner.start / 4); // Push the inner tuple's position (in slots)
    pushValue(vm, 2, Tag.LINK); // Total elements: TUPLE(1) + 1 value + LINK = 3

    // Find the outer tuple
    const outerResult = findTuple(vm, 0);
    expect(outerResult).not.toBeNull();
    expect(outerResult?.size).toBe(1);
  });

  test('should return null when stack is empty', () => {
    const result = findTuple(vm, 0);
    expect(result).toBeNull();
  });

  test('should return null when element is not a tuple', () => {
    // Push a non-tuple value
    pushValue(vm, 42);

    const result = findTuple(vm, 0);
    expect(result).toBeNull();
  });

  test('should find a tuple with offset from the top', () => {
    // Create a tuple: [TUPLE 2, 1, 2, LINK 3] (4 elements)
    const { start } = createSimpleTuple(vm, 1, 2);

    // Save the end position of the tuple
    const tupleEnd = vm.SP;

    // Push some values on top of the tuple
    pushValue(vm, 10);
    pushValue(vm, 20);

    // The tuple's LINK tag is at offset 2 elements (10 and 20) from the current SP
    // Each element is 4 bytes, so the offset is 2 * 4 = 8 bytes
    const result = findTuple(vm, 8);

    expect(result).not.toBeNull();
    expect(result?.start).toBe(start);
    expect(result?.end).toBe(tupleEnd);
    expect(result?.size).toBe(2);
  });

  test('should find an empty tuple', () => {
    // Create an empty tuple: [TUPLE 0, LINK 1]
    const start = vm.SP;
    pushValue(vm, 0, Tag.TUPLE);
    pushValue(vm, 1, Tag.LINK);
    const end = vm.SP;

    const result = findTuple(vm, 0);

    expect(result).not.toBeNull();
    expect(result?.start).toBe(start);
    expect(result?.end).toBe(end);
    expect(result?.size).toBe(0);
    expect(result?.totalSize).toBe(2 * 4); // TUPLE + LINK = 2 elements * 4 bytes
  });

  test('should return null for invalid tuple structure (missing TUPLE tag)', () => {
    // Push just a LINK tag without TUPLE
    pushValue(vm, 1, Tag.LINK);

    const result = findTuple(vm, 0);
    expect(result).toBeNull();
  });

  test('should return null for invalid tuple structure (size mismatch)', () => {
    // Create a tuple with mismatched sizes: TUPLE says 2 elements but LINK says 4
    const _start = vm.SP; // Start position not used in this test
    pushValue(vm, 2, Tag.TUPLE); // Says 2 elements
    pushValue(vm, 1);
    pushValue(vm, 2);
    pushValue(vm, 4, Tag.LINK); // Says 4 total elements (should be 3 for 2 data elements)

    const result = findTuple(vm, 0);
    expect(result).toBeNull();
  });

  test('should handle out of bounds access', () => {
    // Try to access beyond stack bounds
    vm.SP = 0; // Empty stack
    const result = findTuple(vm, 0);
    expect(result).toBeNull();

    // Try with negative offset
    expect(() => findTuple(vm, -1)).not.toThrow();

    // Try with offset beyond stack
    const largeOffset = 1000000;
    expect(() => findTuple(vm, largeOffset)).not.toThrow();
  });

  test('should find tuple after pushing other values', () => {
    // Create a simple tuple with 2 values
    const { start: tupleStart } = createSimpleTuple(vm, 42, 100);

    // Push some other values on top
    pushValue(vm, 500);
    pushValue(vm, 600);

    // The tuple is 3 elements from the current SP (500, 600, and the tuple's LINK tag)
    // Each element is 4 bytes, so offset is 3 * 4 = 12 bytes
    const result = findTuple(vm, 2 * BYTES_PER_ELEMENT);

    expect(result).not.toBeNull();
    expect(result?.start).toBe(tupleStart);
    expect(result?.size).toBe(2);
    expect(result?.totalSize).toBe(4 * 4); // TUPLE + 2 values + LINK = 4 elements
  });

  test('should handle maximum size tuple within limits', () => {
    // Use the maximum allowed size (16-bit unsigned integer)
    const maxSize = 10; // Using a smaller size for testing

    // Create a tuple
    const start = vm.SP;
    pushValue(vm, maxSize, Tag.TUPLE);

    // Push elements
    for (let i = 0; i < maxSize; i++) {
      pushValue(vm, i % 1000); // Keep values within 16-bit range
    }

    // Push LINK tag
    pushValue(vm, maxSize + 1, Tag.LINK);

    const result = findTuple(vm, 0);
    expect(result).not.toBeNull();
    expect(result?.start).toBe(start);
    expect(result?.size).toBe(maxSize);
    expect(result?.totalSize).toBe((maxSize + 2) * 4);
  });
});
