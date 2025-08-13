/**
 * @file src/test/core/list.test.ts
 * Tests for LIST core utilities
 */

import { VM } from '../../core/vm';
import { toTaggedValue, Tag } from '../../core/tagged';
import {
  createList,
  getListSlotCount,
  skipList,
  getListPayloadStart,
  validateListHeader,
  reverseSpan,
} from '../../core/list';

function resetVM(): VM {
  const vm = new VM();
  vm.reset();
  return vm;
}

function getStackDepth(vm: VM): number {
  return vm.getStackData().length;
}

describe('LIST Core Utilities', () => {
  describe('createList', () => {
    it('should create empty LIST', () => {
      const vm = resetVM();
      createList(vm, []);

      expect(getStackDepth(vm)).toBe(1);
      const header = vm.peek();
      expect(getListSlotCount(header)).toBe(0);
    });

    it('should create LIST with single value', () => {
      const vm = resetVM();
      const value = toTaggedValue(42, Tag.SENTINEL);
      createList(vm, [value]);

      expect(getStackDepth(vm)).toBe(2); // header + 1 payload
      const header = vm.peek();
      expect(getListSlotCount(header)).toBe(1);

      // Check payload is at correct position
      // LIST layout: [payload0] [LIST:1] ← TOS
      // So payload is at SP - 4 (one slot below header)
      const payload = vm.memory.readFloat32(0, vm.SP - 4);
      expect(payload).toBe(value);
    });

    it('should create LIST with multiple values in reverse order', () => {
      const vm = resetVM();
      const val1 = toTaggedValue(1, Tag.SENTINEL);
      const val2 = toTaggedValue(2, Tag.SENTINEL);
      const val3 = toTaggedValue(3, Tag.SENTINEL);

      createList(vm, [val1, val2, val3]);

      expect(getStackDepth(vm)).toBe(4); // header + 3 payload
      const header = vm.peek();
      expect(getListSlotCount(header)).toBe(3);

      // Values should be in reverse order: val3, val2, val1, header
      // LIST layout: [val3] [val2] [val1] [LIST:3] ← TOS
      const payload0 = vm.memory.readFloat32(0, vm.SP - 4); // logical first (val1)
      const payload1 = vm.memory.readFloat32(0, vm.SP - 8); // logical second (val2)
      const payload2 = vm.memory.readFloat32(0, vm.SP - 12); // logical third (val3)

      expect(payload0).toBe(val1); // payload[0] = first input value (at SP-4)
      expect(payload1).toBe(val2); // payload[1] = second input value (at SP-8)
      expect(payload2).toBe(val3); // payload[2] = third input value (at SP-12)
    });

    it('should handle mixed tag types', () => {
      const vm = resetVM();
      const intVal = 42;
      const numVal = 3.14; // NUMBER tag
      const strVal = toTaggedValue(100, Tag.STRING);

      createList(vm, [intVal, numVal, strVal]);

      expect(getStackDepth(vm)).toBe(4);
      const header = vm.peek();
      expect(getListSlotCount(header)).toBe(3);
    });
  });

  describe('getListSlotCount', () => {
    it('should extract slot count from LIST header', () => {
      const header = toTaggedValue(5, Tag.LIST);
      expect(getListSlotCount(header)).toBe(5);
    });

    it('should handle zero slot count', () => {
      const header = toTaggedValue(0, Tag.LIST);
      expect(getListSlotCount(header)).toBe(0);
    });

    it('should handle maximum slot count', () => {
      const header = toTaggedValue(65535, Tag.LIST);
      expect(getListSlotCount(header)).toBe(65535);
    });

    it('should throw on non-LIST header', () => {
      const nonList = toTaggedValue(5, Tag.STRING);
      expect(() => getListSlotCount(nonList)).toThrow('Value is not an LIST header');
    });
  });

  describe('skipList', () => {
    it('should skip empty LIST', () => {
      const vm = resetVM();
      createList(vm, []);

      const initialSP = vm.SP;
      skipList(vm);
      const finalSP = vm.SP;

      expect(initialSP - finalSP).toBe(4); // 1 slot * 4 bytes removed
      expect(getStackDepth(vm)).toBe(0);
    });

    it('should skip LIST with single value', () => {
      const vm = resetVM();
      const value = 42;
      createList(vm, [value]);

      const initialSP = vm.SP;
      skipList(vm);
      const finalSP = vm.SP;

      expect(initialSP - finalSP).toBe(8); // 2 slots * 4 bytes removed
      expect(getStackDepth(vm)).toBe(0);
    });

    it('should skip LIST with multiple values', () => {
      const vm = resetVM();
      const values = [1, 2, 3];
      createList(vm, values);

      const initialSP = vm.SP;
      skipList(vm);
      const finalSP = vm.SP;

      expect(initialSP - finalSP).toBe(16); // 4 slots * 4 bytes removed
      expect(getStackDepth(vm)).toBe(0);
    });

    it('should throw on non-LIST at TOS', () => {
      const vm = resetVM();
      vm.push(5);

      expect(() => skipList(vm)).toThrow('Expected LIST header at TOS');
    });
  });

  describe('getListPayloadStart', () => {
    it('should return correct payload start address', () => {
      const vm = resetVM();
      const value = toTaggedValue(42, Tag.SENTINEL);
      createList(vm, [value]);

      const payloadStart = getListPayloadStart(vm);
      const expectedStart = vm.SP - 4; // First payload slot below header

      expect(payloadStart).toBe(expectedStart);

      // Verify we can read the payload value at this address
      // Payload should be at SP - 4 (one slot below header)
      const readValue = vm.memory.readFloat32(0, vm.SP - 4);
      expect(readValue).toBe(value);
    });

    it('should work with empty LIST', () => {
      const vm = resetVM();
      createList(vm, []);

      const payloadStart = getListPayloadStart(vm);
      const expectedStart = vm.SP; // No payload for empty LIST

      expect(payloadStart).toBe(expectedStart);
    });
  });

  describe('validateListHeader', () => {
    it('should validate correct LIST header', () => {
      const vm = resetVM();
      createList(vm, [42]);

      expect(() => validateListHeader(vm)).not.toThrow();
    });

    it('should throw on empty stack', () => {
      const vm = resetVM();

      expect(() => validateListHeader(vm)).toThrow('LIST header validation');
    });

    it('should throw on non-LIST at TOS', () => {
      const vm = resetVM();
      vm.push(5);

      expect(() => validateListHeader(vm)).toThrow('Expected LIST header at TOS');
    });

    it('should throw on insufficient payload space', () => {
      const vm = resetVM();
      // Manually create invalid LIST header claiming 10 slots but no payload
      const invalidHeader = toTaggedValue(10, Tag.LIST);
      vm.push(invalidHeader);

      expect(() => validateListHeader(vm)).toThrow('LIST payload validation');
    });

    it('should throw on slot count exceeding maximum', () => {
      const vm = resetVM();
      // This is a theoretical test - actual toTaggedValue may not allow 65536
      // But we test the validation logic
      try {
        const invalidHeader = toTaggedValue(65536, Tag.LIST);
        vm.push(invalidHeader);
        expect(() => validateListHeader(vm)).toThrow('exceeds maximum of 65535');
      } catch (e) {
        // If toTaggedValue doesn't allow 65536, that's also correct behavior
        expect((e as Error).message).toContain('16-bit');
      }
    });
  });

  describe('reverseSpan', () => {
    it('should handle single element (no change)', () => {
      const vm = resetVM();
      const value = 42;
      vm.push(value);

      reverseSpan(vm, 1);

      expect(vm.peek()).toBe(value);
    });

    it('should handle zero elements (no change)', () => {
      const vm = resetVM();

      expect(() => reverseSpan(vm, 0)).not.toThrow();
    });

    it('should reverse two elements', () => {
      const vm = resetVM();
      const val1 = 1;
      const val2 = 2;

      vm.push(val1);
      vm.push(val2);

      reverseSpan(vm, 2);

      // After reversal: val1 should be at TOS, val2 below it
      expect(vm.peek()).toBe(val1);
      vm.pop();
      expect(vm.peek()).toBe(val2);
    });

    it('should reverse multiple elements', () => {
      const vm = resetVM();
      const val1 = 1;
      const val2 = 2;
      const val3 = 3;
      const val4 = 4;

      vm.push(val1); // Bottom
      vm.push(val2);
      vm.push(val3);
      vm.push(val4); // Top

      reverseSpan(vm, 4);

      // After reversal: val1 at TOS, val4 at bottom
      expect(vm.pop()).toBe(val1);
      expect(vm.pop()).toBe(val2);
      expect(vm.pop()).toBe(val3);
      expect(vm.pop()).toBe(val4);
    });

    it('should reverse odd number of elements', () => {
      const vm = resetVM();
      const val1 = 1;
      const val2 = 2;
      const val3 = 3;

      vm.push(val1);
      vm.push(val2);
      vm.push(val3);

      reverseSpan(vm, 3);

      // After reversal: val1, val2, val3 -> val1, val2, val3
      expect(vm.pop()).toBe(val1);
      expect(vm.pop()).toBe(val2);
      expect(vm.pop()).toBe(val3);
    });

    it('should throw on insufficient stack', () => {
      const vm = resetVM();
      vm.push(1);

      expect(() => reverseSpan(vm, 5)).toThrow('reverse span operation');
    });
  });

  describe('Integration Tests', () => {
    it('should create, validate, and skip LIST in sequence', () => {
      const vm = resetVM();
      const values = [10, 20];

      createList(vm, values);
      expect(getStackDepth(vm)).toBe(3);

      validateListHeader(vm);

      skipList(vm);
      expect(getStackDepth(vm)).toBe(0);
    });

    it('should handle nested LIST creation workflow', () => {
      const vm = resetVM();

      // First create and validate an inner LIST
      const innerValues = [1, 2];
      createList(vm, innerValues);
      validateListHeader(vm);

      // Extract just the header for use as a value (this pops the entire LIST)
      const innerListValue = vm.pop();
      // Clear any remaining payload
      while (vm.getStackData().length > 0) {
        vm.pop();
      }

      // Create outer LIST with the inner LIST as a value
      const outerValues = [0, innerListValue, 3];
      createList(vm, outerValues);

      const outerHeader = vm.peek();
      expect(getListSlotCount(outerHeader)).toBe(3);

      validateListHeader(vm);

      // Skip the entire outer structure
      skipList(vm);
      expect(getStackDepth(vm)).toBe(0);
    });
  });
});
