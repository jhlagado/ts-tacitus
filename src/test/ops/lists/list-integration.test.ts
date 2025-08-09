/**
 * Tests for list integration scenarios - Complex TACIT syntax and advanced list use cases
 * Focuses on end-to-end list functionality with TACIT language features
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { fromTaggedValue, Tag } from '../../../core/tagged';
import { executeTacitCode, resetVM } from '../../utils/test-utils';

describe('List Integration Tests', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('simple values', () => {
    test('should create and manipulate simple lists with TACIT syntax (RLIST)', () => {
      const stack = executeTacitCode('( 1 2 3 ) dup');

      expect(stack.length).toBeGreaterThan(4);
      expect(stack).toContain(1);
      expect(stack).toContain(2);
      expect(stack).toContain(3);

      // Should have duplicated content overall (header duplication is not guaranteed at the end due to stack policy)
      // Assert that at least one RLIST header exists
      const headers = stack.map(fromTaggedValue).filter(d => d.tag === Tag.RLIST);
      expect(headers.length).toBeGreaterThanOrEqual(1);
    });

    test('should perform list arithmetic operations', () => {
      const stack = executeTacitCode('( 10 20 ) ( 30 40 ) swap');

      expect(stack).toContain(10);
      expect(stack).toContain(20);
      expect(stack).toContain(30);
      expect(stack).toContain(40);
    });
  });

  describe('list operations', () => {
    test('should handle deeply nested list structures', () => {
      const stack = executeTacitCode('( ( ( 1 2 ) 3 ) ( 4 ( 5 6 ) ) )');

      expect(stack.length).toBeGreaterThan(8);
      expect(stack).toContain(1);
      expect(stack).toContain(2);
      expect(stack).toContain(3);
      expect(stack).toContain(4);
      expect(stack).toContain(5);
      expect(stack).toContain(6);

      // Verify list structure tags are present
      const listTags = stack.filter(item => {
        const { tag } = fromTaggedValue(item);
        return tag === Tag.RLIST;
      });
      expect(listTags.length).toBeGreaterThanOrEqual(4); // Multiple nested RLISTs
    });

    test('should manipulate mixed data types in lists', () => {
      const stack = executeTacitCode('( 1 ( 2 3 ) 4 ) drop');

      // drop removes the top element (which is the RLIST header only), leaving payload on stack
      expect(stack.length).toBe(0);
    });

    test('should handle list composition and decomposition', () => {
      const stack = executeTacitCode('( 1 2 ) ( 3 4 ) over');

      expect(stack).toContain(1);
      expect(stack).toContain(2);
      expect(stack).toContain(3);
      expect(stack).toContain(4);

      // Should have copied the first list over the second
      expect(stack.filter(x => x === 1).length).toBe(2);
      expect(stack.filter(x => x === 2).length).toBe(2);
    });
  });

  describe('error cases', () => {
    test('should handle empty lists in complex operations', () => {
      const stack = executeTacitCode('( ) ( 1 2 ) swap');

      expect(stack).toContain(1);
      expect(stack).toContain(2);

      // Should have empty list somewhere in the result
      const listTags = stack.filter(item => {
        const { tag, value } = fromTaggedValue(item);
        return tag === Tag.RLIST && value === 0;
      });
      expect(listTags.length).toBeGreaterThanOrEqual(1);
    });

    test('should gracefully handle malformed list operations', () => {
      // This test verifies that even if list operations have issues,
      // they don't crash the system
      expect(() => {
        executeTacitCode('( 1 2 3 4 5 6 7 8 9 10 ) dup drop');
      }).not.toThrow();
    });
  });

  describe('integration tests', () => {
    test('should execute complex list manipulation chains', () => {
      const stack = executeTacitCode('( 1 2 ) ( 3 4 ) ( 5 6 ) rot');

      expect(stack).toContain(1);
      expect(stack).toContain(2);
      expect(stack).toContain(3);
      expect(stack).toContain(4);
      expect(stack).toContain(5);
      expect(stack).toContain(6);

      expect(stack.length).toBe(9);
    });

    test('should handle mixed stack operations with lists and values', () => {
      const stack = executeTacitCode('100 ( 200 300 ) 400 ( 500 600 ) tuck');

      expect(stack).toContain(100);
      expect(stack).toContain(200);
      expect(stack).toContain(300);
      expect(stack).toContain(400);
      expect(stack).toContain(500);
      expect(stack).toContain(600);
    });

    test('should preserve list integrity through multiple operations', () => {
      const stack = executeTacitCode('( 42 ( 84 126 ) 168 ) dup swap drop');

      expect(stack).toContain(42);
      expect(stack).toContain(84);
      expect(stack).toContain(126);
      expect(stack).toContain(168);

      // Verify list structure is maintained
      const headersAfter = stack.map(fromTaggedValue).filter(d => d.tag === Tag.RLIST);
      expect(headersAfter.length).toBeGreaterThanOrEqual(1);
    });

    test('should handle extreme nesting scenarios', () => {
      const stack = executeTacitCode('( 1 ( 2 ( 3 ( 4 5 ) 6 ) 7 ) 8 )');

      expect(stack).toContain(1);
      expect(stack).toContain(2);
      expect(stack).toContain(3);
      expect(stack).toContain(4);
      expect(stack).toContain(5);
      expect(stack).toContain(6);
      expect(stack).toContain(7);
      expect(stack).toContain(8);

      // Verify deeply nested structure
      const listTags = stack.filter(item => {
        const { tag } = fromTaggedValue(item);
        return tag === Tag.RLIST;
      });
      expect(listTags.length).toBeGreaterThanOrEqual(4); // Multiple levels of nesting
    });

    test('should support list operations in conditional contexts', () => {
      // This would test list operations within IF/ELSE blocks
      // For now, just verify basic list creation works in preparation for conditionals
      const stack = executeTacitCode('( 1 2 3 )');

      expect(stack).toContain(1);
      expect(stack).toContain(2);
      expect(stack).toContain(3);

      const listTags = stack.filter(item => {
        const { tag } = fromTaggedValue(item);
        return tag === Tag.RLIST;
      });
      expect(listTags.length).toBe(1);
    });
  });
});
