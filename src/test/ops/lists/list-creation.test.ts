/**
 * Tests for list creation operations - Consolidated from multiple duplicate files
 * Previous files: list-creation.test.ts, lists-creation.test.ts, lists-creation-isolated.test.ts, list-nested.test.ts
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { fromTaggedValue, Tag } from '../../../core/tagged';
import { executeTacitCode, resetVM, logStack } from '../../utils/test-utils';

describe('List Creation Operations', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('simple values', () => {
    test('should create a simple list with 2 elements', () => {
      const stack = executeTacitCode('( 1 2 ) .slot');

      // After .slot, TOS should be an INTEGER 2 and LIST header remains below
      logStack(stack);
      const top = fromTaggedValue(stack[stack.length - 1]);
      expect(top).toEqual({ tag: Tag.INTEGER, value: 2 });
      // LIST header presence is validated by .slot; confirm stack length grows by 1
      expect(stack.length).toBe(4);
    });

    test('should handle empty lists', () => {
      const stack = executeTacitCode('( )');

      // LIST empty: only header with 0 slots
      expect(stack.length).toBe(1);
      const { tag, value } = fromTaggedValue(stack[0]);
      expect(tag).toBe(Tag.LIST);
      expect(value).toBe(0);
    });
  });

  describe('list operations', () => {
    test('should handle a nested list with 1 level of nesting', () => {
      const stack = executeTacitCode('( 1 ( 2 3 ) 4 )');

      // LIST layout total cells: inner (3) + payload(1+1) + outer header(1) = 6
      expect(stack.length).toBe(6);
      const len = stack.length;

      // Outer header
      expect(fromTaggedValue(stack[len - 1])).toEqual({ tag: Tag.LIST, value: 5 });
      // First logical element just below outer header
      expect(fromTaggedValue(stack[len - 2])).toEqual({ tag: Tag.NUMBER, value: 1 });
      // Verify bottom-most element is 4 to ensure payload ordering
      expect(fromTaggedValue(stack[0])).toEqual({ tag: Tag.NUMBER, value: 4 });
    });

    test('should handle multiple nested lists at the same level', () => {
      const stack = executeTacitCode('( ( 1 2 ) ( 3 4 ) )');

      // Outer payload includes two inner LISTs (3 cells each) = 6, plus outer header = 7
      expect(stack.length).toBe(7);
      const len = stack.length;
      expect(fromTaggedValue(stack[len - 1])).toEqual({ tag: Tag.LIST, value: 6 });
    });
  });

  describe('error cases', () => {
    // TODO: Add error handling tests for malformed lists, stack overflow, etc.
  });

  describe('integration tests', () => {
    test('should handle complex mixed nested structures', () => {
      const stack = executeTacitCode('( 1 ( ) ( 2 ( 3 4 ) ) 5 )');

      // Computed total: 9 cells
      expect(stack.length).toBe(9);
      const len = stack.length;
      expect(fromTaggedValue(stack[len - 1]).tag).toBe(Tag.LIST);
    });

    test('should handle deeply nested lists (3+ levels)', () => {
      const stack = executeTacitCode('( 1 ( 2 ( 3 4 ) 5 ) 6 )');

      // Computed total: 9 cells
      expect(stack.length).toBe(9);
      const len = stack.length;
      expect(fromTaggedValue(stack[len - 1])).toEqual({ tag: Tag.LIST, value: 8 });
    });
  });
});
