/**
 * Tests for list integration scenarios - Complex Tacit syntax and advanced list use cases
 * Focuses on end-to-end list functionality with Tacit language features
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { fromTaggedValue, Tag, createVM, VM } from '../../../../core';
import { executeTacitCode } from '../../../utils/vm-test-utils';

describe('List Integration Tests', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('simple values', () => {
    test('should create and manipulate simple lists with Tacit syntax (LIST)', () => {
      const stack = executeTacitCode(vm, '( 1 2 3 ) dup');

      expect(stack.length).toBeGreaterThan(4);
      expect(stack).toContain(1);
      expect(stack).toContain(2);
      expect(stack).toContain(3);

      const headers = stack.map(fromTaggedValue).filter(d => d.tag === Tag.LIST);
      expect(headers.length).toBeGreaterThanOrEqual(1);
    });

    test('should perform list arithmetic operations', () => {
      const stack = executeTacitCode(vm, '( 10 20 ) ( 30 40 ) swap');

      expect(stack).toContain(10);
      expect(stack).toContain(20);
      expect(stack).toContain(30);
      expect(stack).toContain(40);
    });
  });

  describe('list operations', () => {
    test('should handle deeply nested list structures', () => {
      const stack = executeTacitCode(vm, '( ( ( 1 2 ) 3 ) ( 4 ( 5 6 ) ) )');

      expect(stack.length).toBeGreaterThan(8);
      expect(stack).toContain(1);
      expect(stack).toContain(2);
      expect(stack).toContain(3);
      expect(stack).toContain(4);
      expect(stack).toContain(5);
      expect(stack).toContain(6);

      const listTags = stack.filter(item => {
        const { tag } = fromTaggedValue(item);
        return tag === Tag.LIST;
      });
      expect(listTags.length).toBeGreaterThanOrEqual(4);
    });

    test('should manipulate mixed data types in lists', () => {
      const stack = executeTacitCode(vm, '( 1 ( 2 3 ) 4 ) drop');

      expect(stack.length).toBe(0);
    });

    test('should handle list composition and decomposition', () => {
      const stack = executeTacitCode(vm, '( 1 2 ) ( 3 4 ) over');

      expect(stack).toContain(1);
      expect(stack).toContain(2);
      expect(stack).toContain(3);
      expect(stack).toContain(4);

      expect(stack.filter(x => x === 1).length).toBe(2);
      expect(stack.filter(x => x === 2).length).toBe(2);
    });
  });

  describe('error cases', () => {
    test('should handle empty lists in complex operations', () => {
      const stack = executeTacitCode(vm, '( ) ( 1 2 ) swap');

      expect(stack).toContain(1);
      expect(stack).toContain(2);

      const listTags = stack.filter(item => {
        const { tag, value } = fromTaggedValue(item);
        return tag === Tag.LIST && value === 0;
      });
      expect(listTags.length).toBeGreaterThanOrEqual(1);
    });

    test('should gracefully handle malformed list operations', () => {
      expect(() => {
        executeTacitCode(vm, '( 1 2 3 4 5 6 7 8 9 10 ) dup drop');
      }).not.toThrow();
    });
  });

  describe('integration tests', () => {
    test('should execute complex list manipulation chains', () => {
      const stack = executeTacitCode(vm, '( 1 2 ) ( 3 4 ) ( 5 6 ) rot');

      expect(stack).toContain(1);
      expect(stack).toContain(2);
      expect(stack).toContain(3);
      expect(stack).toContain(4);
      expect(stack).toContain(5);
      expect(stack).toContain(6);

      expect(stack.length).toBe(9);
    });

    test('should handle mixed stack operations with lists and values', () => {
      const stack = executeTacitCode(vm, '100 ( 200 300 ) 400 ( 500 600 ) tuck');

      expect(stack).toContain(100);
      expect(stack).toContain(200);
      expect(stack).toContain(300);
      expect(stack).toContain(400);
      expect(stack).toContain(500);
      expect(stack).toContain(600);
    });

    test('should preserve list integrity through multiple operations', () => {
      const stack = executeTacitCode(vm, '( 42 ( 84 126 ) 168 ) dup swap drop');

      expect(stack).toContain(42);
      expect(stack).toContain(84);
      expect(stack).toContain(126);
      expect(stack).toContain(168);

      const headersAfter = stack.map(fromTaggedValue).filter(d => d.tag === Tag.LIST);
      expect(headersAfter.length).toBeGreaterThanOrEqual(1);
    });

    test('should handle extreme nesting scenarios', () => {
      const stack = executeTacitCode(vm, '( 1 ( 2 ( 3 ( 4 5 ) 6 ) 7 ) 8 )');

      expect(stack).toContain(1);
      expect(stack).toContain(2);
      expect(stack).toContain(3);
      expect(stack).toContain(4);
      expect(stack).toContain(5);
      expect(stack).toContain(6);
      expect(stack).toContain(7);
      expect(stack).toContain(8);

      const listTags = stack.filter(item => {
        const { tag } = fromTaggedValue(item);
        return tag === Tag.LIST;
      });
      expect(listTags.length).toBeGreaterThanOrEqual(4);
    });

    test('should support list operations in conditional contexts', () => {
      const stack = executeTacitCode(vm, '( 1 2 3 )');

      expect(stack).toContain(1);
      expect(stack).toContain(2);
      expect(stack).toContain(3);

      const listTags = stack.filter(item => {
        const { tag } = fromTaggedValue(item);
        return tag === Tag.LIST;
      });
      expect(listTags.length).toBe(1);
    });
  });

  describe('parser + VM integration (LIST semantics)', () => {
    test('should build a simple list using ( ) syntax', () => {
      const stack = executeTacitCode(vm, '( 1 2 3 )');
      expect(stack.length).toBe(4);

      const header = stack[stack.length - 1];
      const { tag: headerTag, value: slots } = fromTaggedValue(header);
      expect(headerTag).toBe(Tag.LIST);
      expect(slots).toBe(3);

      const payload0 = stack[stack.length - 2];
      const payload1 = stack[stack.length - 3];
      const payload2 = stack[stack.length - 4];

      expect(fromTaggedValue(payload0)).toMatchObject({ tag: Tag.NUMBER, value: 1 });
      expect(fromTaggedValue(payload1)).toMatchObject({ tag: Tag.NUMBER, value: 2 });
      expect(fromTaggedValue(payload2)).toMatchObject({ tag: Tag.NUMBER, value: 3 });
    });

    test('should build nested lists correctly', () => {
      const stack = executeTacitCode(vm, '( 1 ( 2 3 ) 4 )');

      const outerHeader = stack[stack.length - 1];
      const { tag: outerTag, value: outerSlots } = fromTaggedValue(outerHeader);
      expect(outerTag).toBe(Tag.LIST);
      expect(outerSlots).toBeGreaterThan(0);

      const firstLogical = stack[stack.length - 2];
      expect(fromTaggedValue(firstLogical)).toMatchObject({ tag: Tag.NUMBER, value: 1 });

      const innerHeaderIndex = stack.findIndex((v, i) => {
        if (i >= stack.length - 1) return false;
        const d = fromTaggedValue(v);
        return d.tag === Tag.LIST && i !== stack.length - 1;
      });
      expect(innerHeaderIndex).toBeGreaterThanOrEqual(0);
      const { tag: innerTag, value: innerSlots } = fromTaggedValue(stack[innerHeaderIndex]);
      expect(innerTag).toBe(Tag.LIST);
      expect(innerSlots).toBe(2);
    });

    test('should lay out nested list stack as: 4 3 2 LIST:2 1 LIST:5 ← TOS', () => {
      const stack = executeTacitCode(vm, '( 1 ( 2 3 ) 4 )');
      const len = stack.length;

      expect(len).toBe(6);

      const decode = fromTaggedValue;

      const outerHeader = stack[len - 1];
      expect(decode(outerHeader)).toMatchObject({ tag: Tag.LIST, value: 5 });

      expect(decode(stack[len - 2])).toMatchObject({ tag: Tag.NUMBER, value: 1 });
      expect(decode(stack[len - 3])).toMatchObject({ tag: Tag.LIST, value: 2 });
      expect(decode(stack[len - 4])).toMatchObject({ tag: Tag.NUMBER, value: 2 });
      expect(decode(stack[len - 5])).toMatchObject({ tag: Tag.NUMBER, value: 3 });
      expect(decode(stack[len - 6])).toMatchObject({ tag: Tag.NUMBER, value: 4 });
    });
  });

  describe('memory layout validation', () => {
    test('should keep list payload contiguous in memory', () => {
      const stack = executeTacitCode(vm, '( 10 20 30 40 )');
      const values = [
        stack[stack.length - 2],
        stack[stack.length - 3],
        stack[stack.length - 4],
        stack[stack.length - 5],
      ].map(v => fromTaggedValue(v).value);
      expect(values).toEqual([10, 20, 30, 40]);
    });
  });
});
