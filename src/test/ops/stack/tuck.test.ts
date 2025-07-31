/**
 * @file src/test/ops/stack/tuck.test.ts
 *
 * Test suite for the tuck operation implementation.
 * The tuck operation duplicates the top element and inserts the copy
 * under the second element.
 */

import { vm } from '../../../core/globalState';
import { tuckOp, swapOp, overOp } from '../../../ops/builtins-stack';
import { Tag, toTaggedValue } from '../../../core/tagged';
import { executeTacitCode, resetVM } from '../../utils/test-utils';

describe('tuck Operation', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('simple values', () => {
    test('should duplicate top element under second with simple values', () => {
      vm.push(1); // Second element (will be moved to middle)
      vm.push(2); // Top element (will be duplicated)

      tuckOp(vm);

      expect(vm.getStackData()).toEqual([2, 1, 2]);
    });

    test('should work with multiple simple values on stack', () => {
      resetVM();
      vm.push(10);
      vm.push(20);
      vm.push(30);

      console.log('Before tuck:', vm.getStackData());
      tuckOp(vm);
      console.log('After tuck:', vm.getStackData());

      // Expected: [10, 30, 20, 30]
      // Starting with [10, 20, 30]:
      // - swap makes [10, 30, 20]
      // - over makes [10, 30, 20, 30]
      expect(vm.getStackData()).toEqual([10, 30, 20, 30]);
    });

    test('should work with negative numbers', () => {
      vm.push(-5.5); // Second element (will be moved to middle)
      vm.push(3.14); // Top element (will be duplicated)

      tuckOp(vm);

      const result = vm.getStackData();
      expect(result.length).toBe(3);
      expect(result[0]).toBeCloseTo(3.14, 5);
      expect(result[1]).toBeCloseTo(-5.5, 5);
      expect(result[2]).toBeCloseTo(3.14, 5);
    });

    test('should work with exactly two elements', () => {
      vm.push(100); // Second element (will be moved to middle)
      vm.push(200); // Top element (will be duplicated)

      tuckOp(vm);

      expect(vm.getStackData()).toEqual([200, 100, 200]);
    });
  });

  describe('list operations', () => {
    test('should duplicate simple value under a list', () => {
      // Execute: ( 10 20 ) 42 tuck
      // This should give: 42 ( 10 20 ) 42
      const stack = executeTacitCode('( 10 20 ) 42 tuck');

      // Should have the value duplicated under the list
      expect(stack[0]).toBe(42); // Bottom copy
      expect(stack).toContain(10);
      expect(stack).toContain(20);
      expect(stack[stack.length - 1]).toBe(42); // Top copy
    });

    test('should duplicate list under simple value', () => {
      // Execute: 42 ( 99 88 ) tuck
      // This should give: ( 99 88 ) 42 ( 99 88 )
      const stack = executeTacitCode('42 ( 99 88 ) tuck');

      // Should have the list duplicated under the simple value
      expect(stack).toContain(99);
      expect(stack).toContain(88);
      expect(stack).toContain(42);
      // List elements should appear twice
      expect(stack.filter(x => x === 99).length).toBe(2);
      expect(stack.filter(x => x === 88).length).toBe(2);
    });

    test('should duplicate list under another list', () => {
      // Execute: ( 100 200 ) ( 300 400 ) tuck
      // This should give: ( 300 400 ) ( 100 200 ) ( 300 400 )
      const stack = executeTacitCode('( 100 200 ) ( 300 400 ) tuck');

      // Should have the second list duplicated
      expect(stack).toContain(100);
      expect(stack).toContain(200);
      expect(stack).toContain(300);
      expect(stack).toContain(400);
      // Count occurrences of 300 and 400 - should appear twice each
      expect(stack.filter(x => x === 300).length).toBe(2);
      expect(stack.filter(x => x === 400).length).toBe(2);
    });

    test('should handle multi-element lists', () => {
      // Execute: 999 ( 10 20 30 40 ) tuck
      // This should give: ( 10 20 30 40 ) 999 ( 10 20 30 40 )
      const stack = executeTacitCode('999 ( 10 20 30 40 ) tuck');

      // Should have the large list duplicated
      expect(stack).toContain(999);
      expect(stack).toContain(10);
      expect(stack).toContain(20);
      expect(stack).toContain(30);
      expect(stack).toContain(40);
      // List elements should appear twice
      expect(stack.filter(x => x === 10).length).toBe(2);
      expect(stack.filter(x => x === 20).length).toBe(2);
      expect(stack.filter(x => x === 30).length).toBe(2);
      expect(stack.filter(x => x === 40).length).toBe(2);
    });

    test('should handle nested lists correctly', () => {
      // Execute: ( 1 ( 2 3 ) 4 ) 123 tuck
      // This should duplicate 123 under the nested list
      const stack = executeTacitCode('( 1 ( 2 3 ) 4 ) 123 tuck');

      // Should have 123 duplicated
      expect(stack).toContain(1);
      expect(stack).toContain(2);
      expect(stack).toContain(3);
      expect(stack).toContain(4);
      expect(stack.filter(x => x === 123).length).toBe(2);
    });
  });

  describe('error cases', () => {
    test('should throw on stack underflow with empty stack', () => {
      expect(() => tuckOp(vm)).toThrow();
    });

    test('should throw on stack underflow with only one element', () => {
      vm.push(42);
      expect(() => tuckOp(vm)).toThrow();
    });

    test('should throw on stack underflow with only one list', () => {
      const listTag = toTaggedValue(1, Tag.LIST);
      const linkTag = toTaggedValue(2, Tag.LINK);

      vm.push(listTag);
      vm.push(42);
      vm.push(linkTag);

      // This SHOULD throw because even though a list has multiple physical elements,
      // logically it's still only ONE element on the stack, and tuck requires TWO
      expect(() => tuckOp(vm)).toThrow();
    });
  });
});
