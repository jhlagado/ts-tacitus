/**
 * Unit tests for selectOp helper functions
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { resetVM, executeTacitCode } from '../../utils/vm-test-utils';
import { NIL } from '../../../core/tagged';

describe('selectOp Helper Functions', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('createTargetRef', () => {
    test('should create ref for LIST target', () => {
      // Test that ref op works on list targets
      const result = executeTacitCode('( 1 2 3 ) ref');
      expect(result.length).toBe(5); // original 3 + list + ref
    });

    test('should handle existing STACK_REF target', () => {
      // Test that existing refs can be copied
      const result = executeTacitCode('( 1 2 3 ) ref dup');
      expect(result.length).toBe(6); // original 3 + list + ref + ref
    });

    test('should return NIL for simple value target', () => {
      // Simple targets can't be traversed
      const result = executeTacitCode('42 "key" select');
      expect(result[result.length - 1]).toBe(NIL);
    });
  });

  describe('handleSimplePath', () => {
    test('should handle numeric path element', () => {
      const result = executeTacitCode('( 10 20 30 ) 1 select fetch');
      expect(result[result.length - 1]).toBe(20);
    });

    test('should handle string path element', () => {
      const result = executeTacitCode('( "key" 42 ) "key" select fetch');
      expect(result[result.length - 1]).toBe(42);
    });
  });
});
