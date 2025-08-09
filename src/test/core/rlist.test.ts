/**
 * @file src/test/core/rlist.test.ts
 * Tests for RLIST core utilities
 */

import { VM } from '../../core/vm';
import { toTaggedValue, fromTaggedValue, Tag } from '../../core/tagged';
import {
  createRList,
  getRListSlotCount,
  skipRList,
  getRListPayloadStart,
  validateRListHeader,
  reverseSpan,
} from '../../core/rlist';

function resetVM(): VM {
  const vm = new VM();
  vm.reset();
  return vm;
}

function getStackDepth(vm: VM): number {
  return vm.getStackData().length;
}

describe('RLIST Core Utilities', () => {
  describe('createRList', () => {
    it('should create empty RLIST', () => {
      const vm = resetVM();
      createRList(vm, []);
      
      expect(getStackDepth(vm)).toBe(1);
      const header = vm.peek();
      expect(getRListSlotCount(header)).toBe(0);
    });

    it('should create RLIST with single value', () => {
      const vm = resetVM();
      const value = toTaggedValue(42, Tag.INTEGER);
      createRList(vm, [value]);
      
      expect(getStackDepth(vm)).toBe(2); // header + 1 payload
      const header = vm.peek();
      expect(getRListSlotCount(header)).toBe(1);
      
      // Check payload is at correct position
      // RLIST layout: [payload0] [RLIST:1] ← TOS
      // So payload is at SP - 4 (one slot below header)
      const payload = vm.memory.readFloat32(0, vm.SP - 4);
      expect(payload).toBe(value);
    });

    it('should create RLIST with multiple values in reverse order', () => {
      const vm = resetVM();
      const val1 = toTaggedValue(1, Tag.INTEGER);
      const val2 = toTaggedValue(2, Tag.INTEGER);
      const val3 = toTaggedValue(3, Tag.INTEGER);
      
      createRList(vm, [val1, val2, val3]);
      
      expect(getStackDepth(vm)).toBe(4); // header + 3 payload
      const header = vm.peek();
      expect(getRListSlotCount(header)).toBe(3);
      
      // Values should be in reverse order: val3, val2, val1, header
      // RLIST layout: [val3] [val2] [val1] [RLIST:3] ← TOS
      const payload0 = vm.memory.readFloat32(0, vm.SP - 4);  // logical first (val1)
      const payload1 = vm.memory.readFloat32(0, vm.SP - 8);  // logical second (val2)
      const payload2 = vm.memory.readFloat32(0, vm.SP - 12); // logical third (val3)
      
      expect(payload0).toBe(val1); // payload[0] = first input value (at SP-4)
      expect(payload1).toBe(val2); // payload[1] = second input value (at SP-8)
      expect(payload2).toBe(val3); // payload[2] = third input value (at SP-12)
    });

    it('should handle mixed tag types', () => {
      const vm = resetVM();
      const intVal = toTaggedValue(42, Tag.INTEGER);
      const numVal = 3.14; // NUMBER tag
      const strVal = toTaggedValue(100, Tag.STRING);
      
      createRList(vm, [intVal, numVal, strVal]);
      
      expect(getStackDepth(vm)).toBe(4);
      const header = vm.peek();
      expect(getRListSlotCount(header)).toBe(3);
    });
  });

  describe('getRListSlotCount', () => {
    it('should extract slot count from RLIST header', () => {
      const header = toTaggedValue(5, Tag.RLIST);
      expect(getRListSlotCount(header)).toBe(5);
    });

    it('should handle zero slot count', () => {
      const header = toTaggedValue(0, Tag.RLIST);
      expect(getRListSlotCount(header)).toBe(0);
    });

    it('should handle maximum slot count', () => {
      const header = toTaggedValue(65535, Tag.RLIST);
      expect(getRListSlotCount(header)).toBe(65535);
    });

    it('should throw on non-RLIST header', () => {
      const nonRList = toTaggedValue(5, Tag.STRING);
      expect(() => getRListSlotCount(nonRList)).toThrow('Value is not an RLIST header');
    });
  });

  describe('skipRList', () => {
    it('should skip empty RLIST', () => {
      const vm = resetVM();
      createRList(vm, []);
      
      const initialSP = vm.SP;
      skipRList(vm);
      const finalSP = vm.SP;
      
      expect(initialSP - finalSP).toBe(4); // 1 slot * 4 bytes removed
      expect(getStackDepth(vm)).toBe(0);
    });

    it('should skip RLIST with single value', () => {
      const vm = resetVM();
      const value = toTaggedValue(42, Tag.INTEGER);
      createRList(vm, [value]);
      
      const initialSP = vm.SP;
      skipRList(vm);
      const finalSP = vm.SP;
      
      expect(initialSP - finalSP).toBe(8); // 2 slots * 4 bytes removed
      expect(getStackDepth(vm)).toBe(0);
    });

    it('should skip RLIST with multiple values', () => {
      const vm = resetVM();
      const values = [
        toTaggedValue(1, Tag.INTEGER),
        toTaggedValue(2, Tag.INTEGER),
        toTaggedValue(3, Tag.INTEGER),
      ];
      createRList(vm, values);
      
      const initialSP = vm.SP;
      skipRList(vm);
      const finalSP = vm.SP;
      
      expect(initialSP - finalSP).toBe(16); // 4 slots * 4 bytes removed
      expect(getStackDepth(vm)).toBe(0);
    });

    it('should throw on non-RLIST at TOS', () => {
      const vm = resetVM();
      vm.push(toTaggedValue(5, Tag.INTEGER));
      
      expect(() => skipRList(vm)).toThrow('Expected RLIST header at TOS');
    });
  });

  describe('getRListPayloadStart', () => {
    it('should return correct payload start address', () => {
      const vm = resetVM();
      const value = toTaggedValue(42, Tag.INTEGER);
      createRList(vm, [value]);
      
      const payloadStart = getRListPayloadStart(vm);
      const expectedStart = vm.SP - 4; // First payload slot below header
      
      expect(payloadStart).toBe(expectedStart);
      
      // Verify we can read the payload value at this address
      // Payload should be at SP - 4 (one slot below header)
      const readValue = vm.memory.readFloat32(0, vm.SP - 4);
      expect(readValue).toBe(value);
    });

    it('should work with empty RLIST', () => {
      const vm = resetVM();
      createRList(vm, []);
      
      const payloadStart = getRListPayloadStart(vm);
      const expectedStart = vm.SP; // No payload for empty RLIST
      
      expect(payloadStart).toBe(expectedStart);
    });
  });

  describe('validateRListHeader', () => {
    it('should validate correct RLIST header', () => {
      const vm = resetVM();
      createRList(vm, [toTaggedValue(42, Tag.INTEGER)]);
      
      expect(() => validateRListHeader(vm)).not.toThrow();
    });

    it('should throw on empty stack', () => {
      const vm = resetVM();
      
      expect(() => validateRListHeader(vm)).toThrow('RLIST header validation');
    });

    it('should throw on non-RLIST at TOS', () => {
      const vm = resetVM();
      vm.push(toTaggedValue(5, Tag.INTEGER));
      
      expect(() => validateRListHeader(vm)).toThrow('Expected RLIST header at TOS');
    });

    it('should throw on insufficient payload space', () => {
      const vm = resetVM();
      // Manually create invalid RLIST header claiming 10 slots but no payload
      const invalidHeader = toTaggedValue(10, Tag.RLIST);
      vm.push(invalidHeader);
      
      expect(() => validateRListHeader(vm)).toThrow('RLIST payload validation');
    });

    it('should throw on slot count exceeding maximum', () => {
      const vm = resetVM();
      // This is a theoretical test - actual toTaggedValue may not allow 65536
      // But we test the validation logic
      try {
        const invalidHeader = toTaggedValue(65536, Tag.RLIST);
        vm.push(invalidHeader);
        expect(() => validateRListHeader(vm)).toThrow('exceeds maximum of 65535');
      } catch (e) {
        // If toTaggedValue doesn't allow 65536, that's also correct behavior
        expect((e as Error).message).toContain('16-bit');
      }
    });
  });

  describe('reverseSpan', () => {
    it('should handle single element (no change)', () => {
      const vm = resetVM();
      const value = toTaggedValue(42, Tag.INTEGER);
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
      const val1 = toTaggedValue(1, Tag.INTEGER);
      const val2 = toTaggedValue(2, Tag.INTEGER);
      
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
      const val1 = toTaggedValue(1, Tag.INTEGER);
      const val2 = toTaggedValue(2, Tag.INTEGER);
      const val3 = toTaggedValue(3, Tag.INTEGER);
      const val4 = toTaggedValue(4, Tag.INTEGER);
      
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
      const val1 = toTaggedValue(1, Tag.INTEGER);
      const val2 = toTaggedValue(2, Tag.INTEGER);
      const val3 = toTaggedValue(3, Tag.INTEGER);
      
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
      vm.push(toTaggedValue(1, Tag.INTEGER));
      
      expect(() => reverseSpan(vm, 5)).toThrow('reverse span operation');
    });
  });

  describe('Integration Tests', () => {
    it('should create, validate, and skip RLIST in sequence', () => {
      const vm = resetVM();
      const values = [
        toTaggedValue(10, Tag.INTEGER),
        toTaggedValue(20, Tag.INTEGER),
      ];
      
      createRList(vm, values);
      expect(getStackDepth(vm)).toBe(3);
      
      validateRListHeader(vm);
      
      skipRList(vm);
      expect(getStackDepth(vm)).toBe(0);
    });

    it('should handle nested RLIST creation workflow', () => {
      const vm = resetVM();
      
      // First create and validate an inner RLIST
      const innerValues = [toTaggedValue(1, Tag.INTEGER), toTaggedValue(2, Tag.INTEGER)];
      createRList(vm, innerValues);
      validateRListHeader(vm);
      
      // Extract just the header for use as a value (this pops the entire RLIST)
      const innerRListValue = vm.pop();
      // Clear any remaining payload
      while (vm.getStackData().length > 0) {
        vm.pop();
      }
      
      // Create outer RLIST with the inner RLIST as a value
      const outerValues = [toTaggedValue(0, Tag.INTEGER), innerRListValue, toTaggedValue(3, Tag.INTEGER)];
      createRList(vm, outerValues);
      
      const outerHeader = vm.peek();
      expect(getRListSlotCount(outerHeader)).toBe(3);
      
      validateRListHeader(vm);
      
      // Skip the entire outer structure
      skipRList(vm);
      expect(getStackDepth(vm)).toBe(0);
    });
  });
});