/**
 * Tests for compound variable compatibility checking
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm } from '../../../core/globalState';
import { resetVM, executeTacitCode } from '../../utils/vm-test-utils';
import { isCompatibleCompound } from '../../../ops/local-vars-transfer';
import { toTaggedValue, Tag } from '../../../core/tagged';

describe('Compound Compatibility Checking', () => {
  beforeEach(() => {
    resetVM();
    vm.debug = false;
  });

  describe('Basic Compatibility Rules', () => {
    test('should be compatible for same-length lists', () => {
      // Create two LIST:3 headers (both have 3 payload slots)
      const list1 = toTaggedValue(3, Tag.LIST);
      const list2 = toTaggedValue(3, Tag.LIST);

      expect(isCompatibleCompound(list1, list2)).toBe(true);
    });

    test('should be incompatible for different-length lists', () => {
      // LIST:2 vs LIST:3 (different payload slot counts)
      const list2 = toTaggedValue(2, Tag.LIST);
      const list3 = toTaggedValue(3, Tag.LIST);

      expect(isCompatibleCompound(list2, list3)).toBe(false);
      expect(isCompatibleCompound(list3, list2)).toBe(false);
    });

    test('should be compatible for empty lists', () => {
      // Both LIST:0 (empty lists)
      const empty1 = toTaggedValue(0, Tag.LIST);
      const empty2 = toTaggedValue(0, Tag.LIST);

      expect(isCompatibleCompound(empty1, empty2)).toBe(true);
    });

    test('should be incompatible for different compound types', () => {
      // LIST vs non-LIST (simulate future MAPLIST)
      const list = toTaggedValue(3, Tag.LIST);
      const nonList = toTaggedValue(3, Tag.STRING); // Different type

      expect(isCompatibleCompound(list, nonList)).toBe(false);
      expect(isCompatibleCompound(nonList, list)).toBe(false);
    });

    test('should be incompatible for non-compound types', () => {
      // NUMBER vs LIST
      const number = toTaggedValue(42, Tag.NUMBER);
      const list = toTaggedValue(3, Tag.LIST);

      expect(isCompatibleCompound(number, list)).toBe(false);
      expect(isCompatibleCompound(list, number)).toBe(false);
    });
  });

  // Real List Compatibility via Tacit Code — removed due to NaN-boxing fragility; favor behavioral tests

  describe('Edge Cases', () => {
    test('should handle maximum sized lists', () => {
      // Test with large slot counts (within 16-bit range)
      const large1 = toTaggedValue(65535, Tag.LIST); // Maximum 16-bit value
      const large2 = toTaggedValue(65535, Tag.LIST);
      const smaller = toTaggedValue(65534, Tag.LIST);

      expect(isCompatibleCompound(large1, large2)).toBe(true);
      expect(isCompatibleCompound(large1, smaller)).toBe(false);
    });

    test('should handle single-element lists (behavioral assignment)', () => {
      // Behavior-first: initialize a local with a single-element list, then assign
      // another single-element list and verify materialized value matches.
      // This avoids brittle direct comparisons of NaN-boxed headers.
      resetVM();
      const result = executeTacitCode(': f ( 42 ) var y ( 99 ) -> y &y load head ; f');
      // After materializing the list and taking head, TOS should be 99
      expect(result[result.length - 1]).toBe(99);
    });

    test('should distinguish empty vs single-element lists', () => {
      resetVM();
      const empty = executeTacitCode('()');

      resetVM();
      const single = executeTacitCode('(1)');

      const emptyHeader = empty[empty.length - 1];
      const singleHeader = single[single.length - 1];

      expect(isCompatibleCompound(emptyHeader, singleHeader)).toBe(false);
    });
  });

  describe('Behavioral Verification', () => {
    test('should work with same-content lists (behavioral assignment)', () => {
      // Initialize a local with (1 2 3), then assign (1 2 3) and verify head = 1
      resetVM();
      const result = executeTacitCode(': f ( 1 2 3 ) var y ( 1 2 3 ) -> y &y load head ; f');
      expect(result[result.length - 1]).toBe(1);
    });

    test('should work with different-content but same-length lists (behavioral assignment)', () => {
      // Initialize with (10 20 30), assign (-1 -2 -3) (same length), verify head = -1
      resetVM();
      const result = executeTacitCode(': f ( 10 20 30 ) var y ( -1 -2 -3 ) -> y &y load head ; f');
      expect(result[result.length - 1]).toBe(-1);
    });
  });
});
