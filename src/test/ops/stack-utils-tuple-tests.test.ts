import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from '../../core/vm';
import { SEG_STACK } from '../../core/memory';
import { fromTaggedValue, toTaggedValue, Tag } from '../../core/tagged';
import { findTuple } from '../../ops/stack-utils';

const BYTES_PER_ELEMENT = 4;

describe('findTuple', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
    // Initialize VM with a clean stack
    vm.SP = 0;
  });

  function pushValue(value: number, tag: Tag = Tag.NUMBER): void {
    vm.memory.writeFloat32(SEG_STACK, vm.SP, toTaggedValue(value, tag));
    vm.SP += BYTES_PER_ELEMENT;
  }

  function createSimpleTuple(...values: number[]): void {
    // Push TUPLE tag
    pushValue(values.length, Tag.TUPLE);

    // Push values
    values.forEach(val => pushValue(val));

    // Push LINK tag
    pushValue(values.length + 1, Tag.LINK);
  }

  function createNestedTuple(innerValues: number[], ...outerValues: (number | number[])[]): void {
    // Push TUPLE tag for outer tuple
    pushValue(outerValues.length + 1, Tag.TUPLE); // +1 for inner tuple

    // Push inner tuple
    createSimpleTuple(...innerValues);

    // Calculate total elements for outer values
    let outerValuesSize = 0;

    // Push outer values and calculate their size
    outerValues.forEach(val => {
      if (Array.isArray(val)) {
        createSimpleTuple(...val);
        outerValuesSize += val.length + 2; // +2 for TUPLE and LINK tags
      } else {
        pushValue(val);
        outerValuesSize += 1;
      }
    });

    // Push LINK tag for outer tuple
    // Total elements: 1 (TUPLE) + inner tuple size + outer values size + 1 (LINK)
    const innerTupleSize = innerValues.length + 2; // TUPLE + values + LINK
    const totalElements = 1 + innerTupleSize + outerValuesSize;
    pushValue(totalElements, Tag.LINK);
  }

  test('should find a simple tuple at the top of the stack', () => {
    // Create a simple tuple (1, 2, 3)
    createSimpleTuple(1, 2, 3);

    const result = findTuple(vm, 0);

    expect(result).not.toBeNull();
    if (!result) return; // Type guard

    expect(result).toEqual({
      start: 0, // TUPLE tag at start
      end: 20, // 5 elements * 4 bytes (TUPLE, 1, 2, 3, LINK)
      size: 3, // 3 data elements (1, 2, 3)
      totalSize: 20, // 5 elements * 4 bytes (TUPLE, 1, 2, 3, LINK)
      linkOffset: 16, // LINK is at offset 16 from start (4 elements * 4 bytes)
    });
  });

  test('should find a tuple with an offset from the top', () => {
    // Push some values
    pushValue(42);
    pushValue(43);

    // Create a simple tuple (1, 2)
    createSimpleTuple(1, 2);

    // Debug: Print the entire stack
    console.log('\n=== STACK CONTENTS ===');
    for (let i = 0; i < vm.SP; i += 4) {
      const value = vm.memory.readFloat32(SEG_STACK, i);
      const { tag, value: val } = fromTaggedValue(value);
      console.log(`[${i}] ${Tag[tag]}: ${val}`);
    }
    console.log('====================\n');

    // The offset should be from SP to the LINK tag, including the LINK tag size
    // SP = 24, LINK is at 20, so offset should be 4 (SP - LINK address)
    const offset = 0;
    console.log(`Looking for tuple with offset ${offset} (SP=${vm.SP})`);
    const result = findTuple(vm, offset);

    console.log('Result:', result);

    expect(result).not.toBeNull();
    if (!result) return; // Type guard

    expect(result).toEqual({
      start: 8, // After the two values we pushed
      end: 24, // 8 + 16 bytes (TUPLE, 1, 2, LINK)
      size: 2, // 2 data elements (1, 2)
      totalSize: 16, // 4 elements * 4 bytes (TUPLE, 1, 2, LINK)
      linkOffset: 12, // LINK is at offset 12 from start (3 elements * 4 bytes)
    });
  });

  test('should find a nested tuple', () => {
    // Create a nested tuple: ((1, 2), 3, 4)
    createNestedTuple([1, 2], 3, 4);

    // The outer tuple is at the top, offset 0 points to its LINK tag
    const outerTuple = findTuple(vm, 0);

    expect(outerTuple).not.toBeNull();
    if (!outerTuple) return; // Type guard

    expect(outerTuple.size).toBe(3); // Inner tuple + 2 values

    // The inner tuple is inside the outer tuple, after the TUPLE tag
    // The inner tuple's LINK tag is at offset 20 (5 elements * 4 bytes) from the start
    const innerTupleOffset = 20; // SP - (outerTuple.start + outerTuple.linkOffset)
    const innerTuple = findTuple(vm, innerTupleOffset);

    expect(innerTuple).not.toBeNull();
    if (!innerTuple) return; // Type guard

    expect(innerTuple.size).toBe(2); // Two values in inner tuple

    // The outer tuple should contain the inner tuple
    expect(outerTuple.start).toBe(0);
    expect(innerTuple.start).toBe(4); // After outer TUPLE tag
    expect(outerTuple.end).toBe(36);  // 9 elements * 4 bytes
  });

  test('should return null for invalid tuple structures', () => {
    // Push a TUPLE tag without a matching LINK
    pushValue(2, Tag.TUPLE);
    pushValue(1);
    pushValue(2);
    // Missing LINK tag

    expect(findTuple(vm, 0)).toBeNull();

    // Reset stack
    vm.SP = 0;

    // Push a LINK tag without a matching TUPLE
    pushValue(3, Tag.LINK);

    expect(findTuple(vm, 0)).toBeNull();

    // Reset stack
    vm.SP = 0;

    // Push a TUPLE tag with incorrect element count
    pushValue(3, Tag.TUPLE); // Says 3 elements
    pushValue(1);
    pushValue(2);
    pushValue(4, Tag.LINK); // But LINK says 4 elements

    expect(findTuple(vm, 0)).toBeNull();
  });
});
