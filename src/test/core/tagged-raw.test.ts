/*
 * Tests for corruption-safe tagged value operations using raw bit manipulation.
 */

import { VM } from '../../core/vm';
import { toTaggedValue, fromTaggedValue, Tag } from '../../core/tagged';
import { toTaggedValueRaw, fromTaggedValueRaw, getTagRaw, getValueRaw } from '../../core/tagged-raw';

describe('Raw Bit Tagged Value Operations', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  describe('Basic Raw Operations', () => {
    it('should encode and decode tagged values without corruption', () => {
      const testCases = [
        { value: 100, tag: Tag.CODE },
        { value: 42, tag: Tag.STRING },
        { value: 2, tag: Tag.LIST },
        { value: 65535, tag: Tag.LINK },
        { value: -32768, tag: Tag.INTEGER },
        { value: 32767, tag: Tag.INTEGER },
      ];

      for (const testCase of testCases) {
        // Encode using raw operations
        const rawBits = toTaggedValueRaw(testCase.value, testCase.tag);

        // Decode using raw operations
        const decoded = fromTaggedValueRaw(rawBits);

        expect(decoded.tag).toBe(testCase.tag);
        expect(decoded.value).toBe(testCase.value);
      }
    });

    it('should handle regular IEEE 754 floats correctly', () => {
      const testValues = [0, 1, -1, 3.14159, -2.71828, 1e6, -1e-6];

      for (const value of testValues) {
        const rawBits = toTaggedValueRaw(value, Tag.NUMBER);
        const decoded = fromTaggedValueRaw(rawBits);

        expect(decoded.tag).toBe(Tag.NUMBER);
        expect(decoded.value).toBeCloseTo(value, 6);
      }
    });
  });

  describe('Stack Integrity Tests', () => {
    it('should preserve tagged values through raw stack operations', () => {
      // Push some tagged values using raw operations
      const testValues = [
        { value: 100, tag: Tag.CODE },
        { value: 42, tag: Tag.STRING },
        { value: 2, tag: Tag.LIST },
      ];

      // Push using raw operations
      for (const testCase of testValues) {
        const rawBits = toTaggedValueRaw(testCase.value, testCase.tag);
        vm.pushRawBits(rawBits);
      }

      // Read back using raw operations
      const rawStack = vm.getStackDataRaw();
      expect(rawStack.length).toBe(3);

      // Verify each value preserved its tag and value
      for (let i = 0; i < testValues.length; i++) {
        const decoded = fromTaggedValueRaw(rawStack[i]);
        expect(decoded.tag).toBe(testValues[i].tag);
        expect(decoded.value).toBe(testValues[i].value);
      }
    });

    it.skip('should demonstrate corruption when using regular float operations', () => {
      // Create a tagged value
      const originalBits = toTaggedValueRaw(100, Tag.CODE);

      // Push using raw bits (preserves integrity)
      vm.pushRawBits(originalBits);

      // Read using regular float operation (causes corruption)
      const corruptedValue = vm.pop();
      const corruptedDecoded = fromTaggedValue(corruptedValue);

      // The tag should be corrupted (not Tag.CODE)
      expect(corruptedDecoded.tag).not.toBe(Tag.CODE);

      // But raw operations would preserve it
      vm.pushRawBits(originalBits);
      const preservedBits = vm.popRawBits();
      const preservedDecoded = fromTaggedValueRaw(preservedBits);

      expect(preservedDecoded.tag).toBe(Tag.CODE);
      expect(preservedDecoded.value).toBe(100);
    });
  });

  describe('Utility Functions', () => {
    it('should extract tags efficiently with getTagRaw', () => {
      const testCases = [
        { value: 100, tag: Tag.CODE },
        { value: 42, tag: Tag.STRING },
        { value: 2, tag: Tag.LIST },
      ];

      for (const testCase of testCases) {
        const rawBits = toTaggedValueRaw(testCase.value, testCase.tag);
        const extractedTag = getTagRaw(rawBits);
        expect(extractedTag).toBe(testCase.tag);
      }
    });

    it('should extract values efficiently with getValueRaw', () => {
      const testCases = [
        { value: 100, tag: Tag.CODE },
        { value: 42, tag: Tag.STRING },
        { value: -1000, tag: Tag.INTEGER },
      ];

      for (const testCase of testCases) {
        const rawBits = toTaggedValueRaw(testCase.value, testCase.tag);
        const extractedValue = getValueRaw(rawBits);
        expect(extractedValue).toBe(testCase.value);
      }
    });
  });

  describe('Corruption Detection', () => {
    it.skip('should detect specific 0x7fc20003 → 0x7fc00000 corruption case', () => {
      // This tests the specific corruption pattern mentioned in the docs
      const originalBits = 0x7fc20003; // Custom NaN with specific payload

      // Simulate JavaScript normalization by converting to float and back
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      view.setUint32(0, originalBits, true);
      const asFloat = view.getFloat32(0, true);
      view.setFloat32(0, asFloat, true);
      const normalizedBits = view.getUint32(0, true);

      // Verify corruption occurs
      expect(normalizedBits).not.toBe(originalBits);
      expect(normalizedBits).toBe(0x7fc00000);

      // But our raw operations preserve the original
      vm.pushRawBits(originalBits);
      const preservedBits = vm.popRawBits();
      expect(preservedBits).toBe(originalBits);
    });
  });
});
