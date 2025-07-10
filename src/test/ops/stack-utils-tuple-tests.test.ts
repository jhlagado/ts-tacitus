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

  test('should find a tuple at a given offset', () => {
    // Create a simple tuple (1, 2, 3)
    createSimpleTuple(1, 2, 3);

    // Push some other values on top
    pushValue(42);
    pushValue(43);

    // The tuple is at the bottom of the stack, and we have two values on top
    // Stack layout:
    // [0]: TUPLE 3
    // [4]: 1
    // [8]: 2
    // [12]: 3
    // [16]: LINK 4
    // [20]: 42  (pushed after)
    // [24]: 43  (pushed after)
    // SP = 28

    // The LINK tag is at offset 16 from the start, which is 12 bytes from SP (28 - 16)
    // The findTuple function will adjust for BYTES_PER_ELEMENT internally
    const result = findTuple(vm, 8);

    expect(result).not.toBeNull();
    if (!result) return;

    // The tuple starts at 0 (TUPLE tag) and ends at 20 (after LINK tag)
    expect(result.size).toBe(3);
    expect(result.start).toBe(0);
    expect(result.end).toBe(20);
    expect(result.totalSize).toBe(20);  // 5 elements * 4 bytes
    expect(result.linkOffset).toBe(16); // LINK is at offset 16 from start
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
