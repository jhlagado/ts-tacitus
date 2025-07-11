import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from '../../core/vm';
import { SEG_STACK } from '../../core/memory';
import { toTaggedValue, Tag } from '../../core/tagged';
import { findTuple } from '../ops-utils';

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
    // We'll push the inner tuple's start position (in bytes) as a value
    // Note: We don't need to store vm.SP in a variable since we're not using it
    pushValue(vm, 1, Tag.TUPLE); // Tuple with 1 element
    pushValue(vm, inner.start / 4); // Push the inner tuple's position (in slots)
    pushValue(vm, 2, Tag.LINK); // Total elements: TUPLE(1) + 1 value + LINK = 3
    
    // Find the outer tuple
    const outerResult = findTuple(vm, 0);
    expect(outerResult).not.toBeNull();
    expect(outerResult?.size).toBe(1);
  });
});
