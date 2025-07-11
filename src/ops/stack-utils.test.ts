import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from '../core/vm';
import { SEG_STACK } from '../core/memory';
import { toTaggedValue, fromTaggedValue, Tag } from '../core/tagged';
import { rangeRoll } from '../stack/rotate';
import { findTuple, findElement } from '../stack/find';

// Define BYTES_PER_ELEMENT for use in our tests
const BYTES_PER_ELEMENT = 4; // Each element on the stack is 4 bytes (32-bit float)

// Helper function to create a NaN with specific payload
function createNaN(payload: number): number {
  const view = new DataView(new ArrayBuffer(4));
  // Set sign=0, exponent=all 1s (NaN), mantissa=payload
  view.setUint32(0, 0x7FC00000 | (payload & 0x003FFFFF));
  return view.getFloat32(0, true);
}

// Utility function for creating test tuples on the stack
function createTupleOnStack(vm: VM, elements: number[]): void {
  // Push the tuple tag (with size = number of elements)
  vm.push(toTaggedValue(elements.length, Tag.TUPLE));

  // Push all elements
  for (const element of elements) {
    vm.push(element);
  }

  // Push the link tag (with offset = elements + TUPLE tag)
  vm.push(toTaggedValue(elements.length + 1, Tag.LINK));
}

describe('Stack Utilities', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  describe('rangeRoll', () => {
    test('should handle empty ranges', () => {
      vm.push(1);
      vm.push(2);

      // Should not throw or change stack
      rangeRoll(vm, 0, 0, 1);
      expect(vm.getStackData()).toEqual([1, 2]);
    });

    test('should handle zero shift amount', () => {
      vm.push(1);
      vm.push(2);
      vm.push(3);

      // Should not change stack
      rangeRoll(vm, 0, 12, 0);
      expect(vm.getStackData()).toEqual([1, 2, 3]);
    });

    test('should roll simple values right', () => {
      vm.push(1);
      vm.push(2);
      vm.push(3);
      vm.push(4);

      // Roll all elements right by 1 position (1 slot)
      // [1, 2, 3, 4] -> [4, 1, 2, 3]
      rangeRoll(vm, 0, 4, 1);
      expect(vm.getStackData()).toEqual([4, 1, 2, 3]);

      // Roll again right by 2 positions
      // [4, 1, 2, 3] -> [2, 3, 4, 1]
      rangeRoll(vm, 0, 4, 2);
      expect(vm.getStackData()).toEqual([2, 3, 4, 1]);
    });

    test('should roll simple values left', () => {
      vm.push(1);
      vm.push(2);
      vm.push(3);
      vm.push(4);

      // Roll all elements left by 1 position
      // [1, 2, 3, 4] -> [2, 3, 4, 1]
      rangeRoll(vm, 0, 4, -1);
      expect(vm.getStackData()).toEqual([2, 3, 4, 1]);

      // Roll again left by 2 positions
      // [2, 3, 4, 1] -> [4, 1, 2, 3]
      rangeRoll(vm, 0, 4, -2);
      expect(vm.getStackData()).toEqual([4, 1, 2, 3]);
    });

    test('should handle shift amounts larger than range size', () => {
      vm.push(1);
      vm.push(2);
      vm.push(3);

      // Roll by amount equal to range size (3 slots)
      // [1, 2, 3] -> [1, 2, 3] (no change)
      rangeRoll(vm, 0, 3, 3);
      expect(vm.getStackData()).toEqual([1, 2, 3]);

      // Roll by 5 slots, which is equivalent to rolling by 2 positions (5 % 3 = 2)
      // [1, 2, 3] -> [2, 3, 1]
      rangeRoll(vm, 0, 3, 5);
      expect(vm.getStackData()).toEqual([2, 3, 1]);

      // Roll by -5 slots, which is equivalent to rolling by 1 position right (-5 % 3 = 1)
      // [2, 3, 1] -> [1, 2, 3]
      rangeRoll(vm, 0, 3, -5);
      expect(vm.getStackData()).toEqual([1, 2, 3]);
    });

    test('should roll a subrange of elements', () => {
      vm.push(1);
      vm.push(2);
      vm.push(3);
      vm.push(4);
      vm.push(5);

      // Roll middle 3 elements right by 1 position
      // [1, 2, 3, 4, 5] -> [1, 4, 2, 3, 5]
      rangeRoll(vm, 1, 3, 1);
      expect(vm.getStackData()).toEqual([1, 4, 2, 3, 5]);
    });

    test('should handle rolling with tuple structures', () => {
      // Create tuple (10, 20)
      createTupleOnStack(vm, [10, 20]);

      // Create another tuple (30, 40)
      createTupleOnStack(vm, [30, 40]);

      // Initial stack: [TUPLE(2), 10, 20, LINK(2), TUPLE(2), 30, 40, LINK(2)]

      // Roll the entire stack right by 4 elements (4 slots)
      // This should move the first tuple to the top
      rangeRoll(vm, 0, 8, 4);

      // Expected: [TUPLE(2), 30, 40, LINK(2), TUPLE(2), 10, 20, LINK(2)]
      // Direct verification with memory access instead of stackData

      // Verify first tuple tag
      expect(vm.memory.readFloat32(SEG_STACK, 0)).toBe(toTaggedValue(2, Tag.TUPLE));

      // Verify first tuple elements
      expect(vm.memory.readFloat32(SEG_STACK, 4)).toBe(30);
      expect(vm.memory.readFloat32(SEG_STACK, 8)).toBe(40);

      // Verify first tuple link
      expect(vm.memory.readFloat32(SEG_STACK, 12)).toBe(toTaggedValue(2, Tag.LINK));

      // Verify second tuple tag
      expect(vm.memory.readFloat32(SEG_STACK, 16)).toBe(toTaggedValue(2, Tag.TUPLE));

      // Verify second tuple elements
      expect(vm.memory.readFloat32(SEG_STACK, 20)).toBe(10);
      expect(vm.memory.readFloat32(SEG_STACK, 24)).toBe(20);

      // Verify second tuple link
      expect(vm.memory.readFloat32(SEG_STACK, 28)).toBe(toTaggedValue(2, Tag.LINK));
    });

    test('should handle tuples of different sizes', () => {
      // Reset the VM to start with an empty stack
      vm = new VM();

      // Start with two tuples and record their tags and values directly
      vm.push(toTaggedValue(3, Tag.TUPLE)); // First tuple has 3 elements
      vm.push(10);
      vm.push(20);
      vm.push(30);
      vm.push(toTaggedValue(4, Tag.LINK)); // LINK value includes the TUPLE tag

      vm.push(toTaggedValue(2, Tag.TUPLE)); // Second tuple has 2 elements
      vm.push(40);
      vm.push(50);
      vm.push(toTaggedValue(3, Tag.LINK)); // LINK value includes the TUPLE tag

      // Initial stack: [TUPLE(3), 10, 20, 30, LINK(4), TUPLE(2), 40, 50, LINK(3)]

      // Save the initial values and decoded tags/values
      console.log('Initial stack:');
      const initialStack = [];
      for (let i = 0; i < 9; i++) {
        const rawValue = vm.memory.readFloat32(SEG_STACK, i * BYTES_PER_ELEMENT);
        const decoded = fromTaggedValue(rawValue);
        initialStack.push({ raw: rawValue, tag: decoded.tag, value: decoded.value });
        console.log(`${i}: tag=${decoded.tag}, value=${decoded.value}`);
      }

      // We want to rotate the stack by a complete tuple unit
      // For this test, let's rotate one complete tuple
      const totalSlots = 9; // Total slots in the stack

      // We need to rotate by the size of the first tuple (4 slots: TUPLE + 3 elements + LINK)
      // to move it to the bottom of the stack
      const rotateSlots = 4; // Size of the first tuple in slots

      // This will rotate the stack right by rotateSlots positions
      rangeRoll(vm, 0, totalSlots, rotateSlots);

      console.log('\nRotated stack:');
      const rotatedStack = [];
      for (let i = 0; i < 9; i++) {
        const rawValue = vm.memory.readFloat32(SEG_STACK, i * BYTES_PER_ELEMENT);
        const decoded = fromTaggedValue(rawValue);
        rotatedStack.push({ raw: rawValue, tag: decoded.tag, value: decoded.value });
        console.log(`${i}: tag=${decoded.tag}, value=${decoded.value}`);
      }

      // After rotation, the stack should have the second tuple moved to the top
      // and the first tuple shifted down
      // Expected layout: [TUPLE(2), 40, 50, LINK(3), TUPLE(3), 10, 20, 30, LINK(4)]

      // Position 0 should be the TUPLE tag from the second tuple
      const posZero = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, 0 * BYTES_PER_ELEMENT));
      expect(posZero.tag).toBe(Tag.TUPLE);
      expect(posZero.value).toBe(2);

      // Positions 1-2 should be values from the second tuple
      const posOne = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, 1 * BYTES_PER_ELEMENT));
      const posTwo = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, 2 * BYTES_PER_ELEMENT));
      expect(posOne.tag).toBe(Tag.NUMBER);
      expect(posOne.value).toBe(40);
      expect(posTwo.tag).toBe(Tag.NUMBER);
      expect(posTwo.value).toBe(50);

      // Position 3 should be the LINK tag from the second tuple
      const posThree = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, 3 * BYTES_PER_ELEMENT));
      expect(posThree.tag).toBe(Tag.LINK);
      expect(posThree.value).toBe(3);

      // Position 4 should be the TUPLE tag from the first tuple
      const posFour = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, 4 * BYTES_PER_ELEMENT));
      expect(posFour.tag).toBe(Tag.TUPLE);
      expect(posFour.value).toBe(3);

      // Positions 5-7 should be values from the first tuple
      const posFive = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, 5 * BYTES_PER_ELEMENT));
      const posSix = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, 6 * BYTES_PER_ELEMENT));
      const posSeven = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, 7 * BYTES_PER_ELEMENT));
      expect(posFive.tag).toBe(Tag.NUMBER);
      expect(posFive.value).toBe(10);
      expect(posSix.tag).toBe(Tag.NUMBER);
      expect(posSix.value).toBe(20);
      expect(posSeven.tag).toBe(Tag.NUMBER);
      expect(posSeven.value).toBe(30);

      // Position 8 should be the LINK tag from the first tuple
      const posEight = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, 8 * BYTES_PER_ELEMENT));
      expect(posEight.tag).toBe(Tag.LINK);
      expect(posEight.value).toBe(4);
    });

    test('should handle NaN values correctly', () => {
      // Create NaN values with different payloads
      const nan1 = createNaN(0x123456);
      const nan2 = createNaN(0x789ABC);

      // Push NaN values
      vm.push(nan1);
      vm.push(nan2);

      // Rotate the two NaN values
      rangeRoll(vm, 0, 2, 1);

      // Read back values as Uint32 to verify exact bit patterns
      const view = new DataView(new ArrayBuffer(4));
      view.setFloat32(0, vm.memory.readFloat32(SEG_STACK, 0), true);
      const val1 = view.getUint32(0, true);

      view.setFloat32(0, vm.memory.readFloat32(SEG_STACK, BYTES_PER_ELEMENT), true);
      const val2 = view.getUint32(0, true);

      // Check that the NaN values were swapped exactly
      view.setFloat32(0, nan1, true);
      const expectedNan1 = view.getUint32(0, true);

      view.setFloat32(0, nan2, true);
      const expectedNan2 = view.getUint32(0, true);

      expect(val1).toBe(expectedNan2);
      expect(val2).toBe(expectedNan1);
    });

    test('should handle mixed tuples and simple values', () => {
      // Clear any existing stack
      vm.SP = 0;

      // Create a simple stack: [TUPLE, 1, 2, LINK, TUPLE, 3, 4, 5, LINK]
      createTupleOnStack(vm, [1, 2]);  // Creates [TUPLE, 1, 2, LINK]

      createTupleOnStack(vm, [3, 4, 5]); // Creates another tuple at the top

      // Get the stack size in slots (each element is 4 bytes)
      const stackSizeInSlots = vm.SP / BYTES_PER_ELEMENT;

      // Find both tuples using their known positions
      const secondTuple = findTuple(vm, 0);  // The second tuple is at the top
      expect(secondTuple).not.toBeNull();
      expect(secondTuple?.size).toBe(3);  // Should have 3 elements

      // The first tuple is at the bottom (offset by the size of the second tuple)
      const firstTuple = findTuple(vm, secondTuple!.totalSize);
      expect(firstTuple).not.toBeNull();
      expect(firstTuple?.size).toBe(2);  // Should have 2 elements

      // Rotate the entire stack by the size of the second tuple in slots
      // This will move the second tuple to the bottom
      rangeRoll(vm, 0, stackSizeInSlots, secondTuple!.totalSize / BYTES_PER_ELEMENT);

      // Verify the stack size hasn't changed
      expect(vm.SP).toBe(stackSizeInSlots * BYTES_PER_ELEMENT);

      // After rotation, the first tuple (originally at the bottom) should now be at the top
      const rotatedFirstTuple = findTuple(vm, 0);
      expect(rotatedFirstTuple).not.toBeNull();
      expect(rotatedFirstTuple?.size).toBe(2);

      // The second tuple should now be at the bottom
      const rotatedSecondTuple = findTuple(vm, rotatedFirstTuple!.totalSize);
      expect(rotatedSecondTuple).not.toBeNull();
      expect(rotatedSecondTuple?.size).toBe(3);

      // Verify the stack contents after rotation
      const stack = [];
      for (let i = 0; i < vm.SP; i += BYTES_PER_ELEMENT) {
        stack.push(vm.memory.readFloat32(SEG_STACK, i));
      }

      // First tuple (originally second) should now be at the bottom
      expect(stack[0]).toBe(toTaggedValue(3, Tag.TUPLE));  // TUPLE tag for [3,4,5]
      expect(stack[1]).toBe(3);
      expect(stack[2]).toBe(4);
      expect(stack[3]).toBe(5);
      expect(stack[4]).toBe(toTaggedValue(4, Tag.LINK));  // LINK for [3,4,5]

      // Second tuple (originally first) should be at the top
      expect(stack[5]).toBe(toTaggedValue(2, Tag.TUPLE));  // TUPLE tag for [1,2]
      expect(stack[6]).toBe(1);
      expect(stack[7]).toBe(2);
      expect(stack[8]).toBe(toTaggedValue(3, Tag.LINK));   // LINK for [1,2]
    });

    test('should handle rotating a tuple with two simple values', () => {
      // Clear any existing stack
      vm.SP = 0;

      // Create a tuple (1 2)
      createTupleOnStack(vm, [1, 2]);

      // Push simple values 3 and 4
      vm.push(3);
      vm.push(4);

      // Log initial stack
      console.log('\n=== BEFORE ROTATION ===');
      for (let i = 0; i < vm.SP; i += BYTES_PER_ELEMENT) {
        const raw = vm.memory.readFloat32(SEG_STACK, i);
        const { tag, value } = fromTaggedValue(raw);
        console.log(`[${i}]: ${raw} (${Tag[tag]}: ${value})`);
      }

      // We want to rotate the top 3 items: [TUPLE(2), 1, 2, LINK(3), 3, 4] -> [3, 4, TUPLE(2), 1, 2, LINK(3)]
      // The range to rotate is from the start of the tuple to the top of the stack
      const rangeSizeInSlots = vm.SP / BYTES_PER_ELEMENT; // Convert bytes to slots
      const rotateAmount = 2; // Rotate by 2 elements (3 and 4)

      // Perform the rotation
      rangeRoll(vm, 0, rangeSizeInSlots, rotateAmount);

      // Log the stack after rotation
      console.log('\n=== AFTER ROTATION ===');
      for (let i = 0; i < vm.SP; i += BYTES_PER_ELEMENT) {
        const raw = vm.memory.readFloat32(SEG_STACK, i);
        const { tag, value } = fromTaggedValue(raw);
        console.log(`[${i}]: ${raw} (${Tag[tag]}: ${value})`);
      }

      // Verify the stack layout
      // Expected: [3, 4, TUPLE(2), 1, 2, LINK(3)]
      let offset = 0;

      // First value should be 3
      const val1 = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, offset));
      expect(val1.tag).toBe(Tag.NUMBER);
      expect(val1.value).toBe(3);
      offset += BYTES_PER_ELEMENT;

      // Second value should be 4
      const val2 = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, offset));
      expect(val2.tag).toBe(Tag.NUMBER);
      expect(val2.value).toBe(4);
      offset += BYTES_PER_ELEMENT;

      // TUPLE tag should be next
      const tupleTag = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, offset));
      expect(tupleTag.tag).toBe(Tag.TUPLE);
      expect(tupleTag.value).toBe(2);
      offset += BYTES_PER_ELEMENT;

      // Tuple values should be next
      const tupleValue1 = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, offset));
      expect(tupleValue1.tag).toBe(Tag.NUMBER);
      expect(tupleValue1.value).toBe(1);
      offset += BYTES_PER_ELEMENT;

      const tupleValue2 = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, offset));
      expect(tupleValue2.tag).toBe(Tag.NUMBER);
      expect(tupleValue2.value).toBe(2);
      offset += BYTES_PER_ELEMENT;

      // LINK tag should be last
      const linkTag = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, offset));
      expect(linkTag.tag).toBe(Tag.LINK);
      expect(linkTag.value).toBe(3);
    });
  }); // End of rangeRoll describe block

describe('findTuple', () => {
    test('should return null when stack is empty', () => {
      expect(findTuple(vm)).toBeNull();
    });

    test('should return null when element is not a tuple', () => {
      vm.push(42);
      expect(findTuple(vm)).toBeNull();
    });

    test('should find a simple tuple at the top of the stack', () => {
      createTupleOnStack(vm, [10, 20]);

      const result = findTuple(vm);
      expect(result).not.toBeNull();
      expect(result?.size).toBe(2);
      // 4 bytes * (TUPLE tag + 2 elements + LINK tag) = 16 bytes
      expect(result?.totalSize).toBe(16);
    });

    test('should find a tuple with offset from the top', () => {
      createTupleOnStack(vm, [10, 20]);
      vm.push(42);

      const result = findTuple(vm, 4); // 4 bytes offset
      expect(result).not.toBeNull();
      expect(result?.size).toBe(2);
    });

    test('should find an empty tuple', () => {
      createTupleOnStack(vm, []);

      const result = findTuple(vm);
      expect(result).not.toBeNull();
      expect(result?.size).toBe(0);
      // 4 bytes * (TUPLE tag + 0 elements + LINK tag) = 8 bytes
      expect(result?.totalSize).toBe(8);
    });

    test('should find a nested tuple', () => {
      // Create inner tuple (30, 40)
      createTupleOnStack(vm, [30, 40]);

      // Create outer tuple with inner tuple's link as an element [10, 20, innerTupleLink]
      const innerTupleLink = vm.peek();
      vm.push(toTaggedValue(3, Tag.TUPLE));
      vm.push(10);
      vm.push(20);
      vm.push(innerTupleLink);
      // The LINK value should be elements (3) + TUPLE tag (1) = 4
      vm.push(toTaggedValue(4, Tag.LINK));

      const outerTuple = findTuple(vm);
      expect(outerTuple).not.toBeNull();
      expect(outerTuple?.size).toBe(3);
    });
  });

  test('should handle NaN values correctly', () => {
    // Create NaN values with different payloads
    const nan1 = createNaN(0x123456);
    const nan2 = createNaN(0x789ABC);

    // Push NaN values
    vm.push(nan1);
    vm.push(nan2);

    // Rotate the two NaN values
    rangeRoll(vm, 0, 2, 1);

    // Read back values as Uint32 to verify exact bit patterns
    const view = new DataView(new ArrayBuffer(4));
    view.setFloat32(0, vm.memory.readFloat32(SEG_STACK, 0), true);
    const val1 = view.getUint32(0, true);

    view.setFloat32(0, vm.memory.readFloat32(SEG_STACK, BYTES_PER_ELEMENT), true);
    const val2 = view.getUint32(0, true);

    // Check that the NaN values were swapped exactly
    view.setFloat32(0, nan1, true);
    const expectedNan1 = view.getUint32(0, true);

    view.setFloat32(0, nan2, true);
    const expectedNan2 = view.getUint32(0, true);

    expect(val1).toBe(expectedNan2);
    expect(val2).toBe(expectedNan1);
  });

  test('should handle mixed tuples and simple values', () => {
    // Clear any existing stack
    vm.SP = 0;

    // Create a simple stack: [TUPLE, 1, 2, LINK, TUPLE, 3, 4, 5, LINK]
    createTupleOnStack(vm, [1, 2]);  // Creates [TUPLE, 1, 2, LINK]

    createTupleOnStack(vm, [3, 4, 5]); // Creates another tuple at the top

    // Get the stack size in slots (each element is 4 bytes)
    const stackSizeInSlots = vm.SP / BYTES_PER_ELEMENT;

    // Find both tuples using their known positions
    const secondTuple = findTuple(vm, 0);  // The second tuple is at the top
    expect(secondTuple).not.toBeNull();
    expect(secondTuple?.size).toBe(3);  // Should have 3 elements

    // The first tuple is at the bottom (offset by the size of the second tuple)
    const firstTuple = findTuple(vm, secondTuple!.totalSize);
    expect(firstTuple).not.toBeNull();
    expect(firstTuple?.size).toBe(2);  // Should have 2 elements

    // Rotate the entire stack by the size of the second tuple in slots
    // This will move the second tuple to the bottom
    rangeRoll(vm, 0, stackSizeInSlots, secondTuple!.totalSize / BYTES_PER_ELEMENT);

    // Verify the stack size hasn't changed
    expect(vm.SP).toBe(stackSizeInSlots * BYTES_PER_ELEMENT);

    // After rotation, the first tuple (originally at the bottom) should now be at the top
    const rotatedFirstTuple = findTuple(vm, 0);
    expect(rotatedFirstTuple).not.toBeNull();
    expect(rotatedFirstTuple?.size).toBe(2);

    // The second tuple should now be at the bottom
    const rotatedSecondTuple = findTuple(vm, rotatedFirstTuple!.totalSize);
    expect(rotatedSecondTuple).not.toBeNull();
    expect(rotatedSecondTuple?.size).toBe(3);

    // Verify the stack contents after rotation
    const stack = [];
    for (let i = 0; i < vm.SP; i += BYTES_PER_ELEMENT) {
      stack.push(vm.memory.readFloat32(SEG_STACK, i));
    }

    // First tuple (originally second) should now be at the bottom
    expect(stack[0]).toBe(toTaggedValue(3, Tag.TUPLE));  // TUPLE tag for [3,4,5]
    expect(stack[1]).toBe(3);
    expect(stack[2]).toBe(4);
    expect(stack[3]).toBe(5);
    expect(stack[4]).toBe(toTaggedValue(4, Tag.LINK));  // LINK for [3,4,5]

    // Second tuple (originally first) should be at the top
    expect(stack[5]).toBe(toTaggedValue(2, Tag.TUPLE));  // TUPLE tag for [1,2]
    expect(stack[6]).toBe(1);
    expect(stack[7]).toBe(2);
    expect(stack[8]).toBe(toTaggedValue(3, Tag.LINK));   // LINK for [1,2]
  });

  test('should handle rotating a tuple with two simple values', () => {
    // Clear any existing stack
    vm.SP = 0;

    // Create a tuple (1 2)
    createTupleOnStack(vm, [1, 2]);

    // Push simple values 3 and 4
    vm.push(3);
    vm.push(4);

    // Log initial stack
    console.log('\n=== BEFORE ROTATION ===');
    for (let i = 0; i < vm.SP; i += BYTES_PER_ELEMENT) {
      const raw = vm.memory.readFloat32(SEG_STACK, i);
      const { tag, value } = fromTaggedValue(raw);
      console.log(`[${i}]: ${raw} (${Tag[tag]}: ${value})`);
    }

    // We want to rotate the top 3 items: [TUPLE(2), 1, 2, LINK(3), 3, 4] -> [3, 4, TUPLE(2), 1, 2, LINK(3)]
    // The range to rotate is from the start of the tuple to the top of the stack
    const rangeSizeInSlots = vm.SP / BYTES_PER_ELEMENT; // Convert bytes to slots
    const rotateAmount = 2; // Rotate by 2 elements (3 and 4)

    // Perform the rotation
    rangeRoll(vm, 0, rangeSizeInSlots, rotateAmount);

    // Log the stack after rotation
    console.log('\n=== AFTER ROTATION ===');
    for (let i = 0; i < vm.SP; i += BYTES_PER_ELEMENT) {
      const raw = vm.memory.readFloat32(SEG_STACK, i);
      const { tag, value } = fromTaggedValue(raw);
      console.log(`[${i}]: ${raw} (${Tag[tag]}: ${value})`);
    }

    // Verify the stack layout
    // Expected: [3, 4, TUPLE(2), 1, 2, LINK(3)]
    let offset = 0;

    // First value should be 3
    const val1 = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, offset));
    expect(val1.tag).toBe(Tag.NUMBER);
    expect(val1.value).toBe(3);
    offset += BYTES_PER_ELEMENT;

    // Second value should be 4
    const val2 = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, offset));
    expect(val2.tag).toBe(Tag.NUMBER);
    expect(val2.value).toBe(4);
    offset += BYTES_PER_ELEMENT;

    // Third value should be TUPLE(2)
    const tupleTag = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, offset));
    expect(tupleTag.tag).toBe(Tag.TUPLE);
    expect(tupleTag.value).toBe(2);
    offset += BYTES_PER_ELEMENT;

    // Fourth value should be 1
    const val3 = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, offset));
    expect(val3.tag).toBe(Tag.NUMBER);
    expect(val3.value).toBe(1);
    offset += BYTES_PER_ELEMENT;

    // Fifth value should be 2
    const val4 = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, offset));
    expect(val4.tag).toBe(Tag.NUMBER);
    expect(val4.value).toBe(2);
    offset += BYTES_PER_ELEMENT;

    // Sixth value should be LINK(3)
    const linkTag = fromTaggedValue(vm.memory.readFloat32(SEG_STACK, offset));
    expect(linkTag.tag).toBe(Tag.LINK);
    expect(linkTag.value).toBe(3);
  });

  test('should handle large tuples correctly', () => {
    // Create a large tuple with 20 elements (reduced from 100 to prevent stack overflow)
    const largeTuple = Array.from({length: 20}, (_, i) => i);
    createTupleOnStack(vm, largeTuple);

    // Capture initial state
    const initialStack = new Float32Array(vm.SP);
    for (let i = 0; i < initialStack.length; i++) {
      initialStack[i] = vm.memory.readFloat32(SEG_STACK, i);
    }

    // Calculate the number of slots in the tuple (TUPLE + elements + LINK)
    const tupleSlots = 1 + largeTuple.length + 1;
    
    // Rotate the entire tuple by 10 elements
    rangeRoll(vm, 0, tupleSlots, 10);

    // Rotate back
    rangeRoll(vm, 0, tupleSlots, -10);

    // Verify the stack is exactly as it was
    for (let i = 0; i < initialStack.length; i++) {
      const val = vm.memory.readFloat32(SEG_STACK, i);
      expect(val).toBe(initialStack[i]);
    }
  });

  test('should handle nested tuples correctly', () => {
    // Create a nested tuple structure: (1, (2, 3), 4)

    // First, create the inner tuple (2, 3)
    createTupleOnStack(vm, [2, 3]);
    const innerTupleStart = vm.SP - 4 * BYTES_PER_ELEMENT; // Position of inner TUPLE tag

    // Now create the outer tuple (1, <inner-tuple>, 4)
    const outerElements = [1];
    // Push the inner tuple's TUPLE tag
    outerElements.push(vm.memory.readFloat32(SEG_STACK, innerTupleStart));
    // Push the inner tuple elements (2, 3, LINK)
    for (let i = 1; i <= 3; i++) {
      outerElements.push(vm.memory.readFloat32(SEG_STACK, innerTupleStart + i * BYTES_PER_ELEMENT));
    }
    // Add the final element
    outerElements.push(4);

    // Clear the stack and create the outer tuple
    vm.SP = 0;
    createTupleOnStack(vm, outerElements);

    // Get the positions of both tuples
    const outerTupleStart = 0;
    const currentInnerTupleStart = 2 * BYTES_PER_ELEMENT; // After TUPLE tag and 1

    // Verify initial structure
    const outerTuple = findTuple(vm, outerTupleStart);
    expect(outerTuple).not.toBeNull();
    expect(outerTuple?.size).toBe(outerElements.length);

    // Rotate the entire structure by 1 element
    const stackSizeInSlots = vm.SP / BYTES_PER_ELEMENT;
    rangeRoll(vm, 0, stackSizeInSlots, 1);

    // Rotate back
    rangeRoll(vm, 0, stackSizeInSlots, -1);

    // Verify the tuple structure is still valid
    const outerTupleAfter = findTuple(vm, outerTupleStart);
    expect(outerTupleAfter).not.toBeNull();
    expect(outerTupleAfter?.size).toBe(outerElements.length);

    // Verify inner tuple is still valid
    const innerTuple = findTuple(vm, currentInnerTupleStart);
    expect(innerTuple).not.toBeNull();
    expect(innerTuple?.size).toBe(2); // Inner tuple has 2 elements
  });

  describe('findElement', () => {
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
});
