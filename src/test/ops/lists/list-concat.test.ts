/**
 * Tests for concat operation - documents current incomplete implementation
 * NOTE: concat operation is currently incomplete (only creates headers without payload)
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { executeTacitCode, resetVM } from '../../utils/vm-test-utils';
import { isNIL } from '../../../core/tagged';
import { isList } from '../../../core/list';

describe('concat Operation Tests - Current Behavior Documentation', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('Fallback semantics work correctly', () => {
    test('should return NIL when first argument is not a list', () => {
      const stack = executeTacitCode('42 ( 1 2 ) concat');
      const result = stack[stack.length - 1];
      expect(isNIL(result)).toBe(true);
    });

    test('should perform cons when second argument is not a list', () => {
      const stack = executeTacitCode('( 1 2 ) 3 concat');
      const header = stack[stack.length - 1];
      expect(isList(header)).toBe(true);
    });

    test('should handle neither argument being a list', () => {
      const stack = executeTacitCode('42 "hello" concat');
      const result = stack[stack.length - 1];
      expect(isNIL(result)).toBe(true);
    });
  });

  describe('Empty list cases work', () => {
    test('should concatenate two empty lists', () => {
      const stack = executeTacitCode('( ) ( ) concat');
      const header = stack[stack.length - 1];
      expect(isList(header)).toBe(true);
    });
  });

  // NOTE: Full list-to-list concatenation is incomplete in current implementation
  // The operation creates headers but doesn't copy payload data correctly
  // This should be addressed in a future implementation phase
});