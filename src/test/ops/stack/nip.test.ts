/**
 * @file src/test/ops/stack/nip.test.ts
 *
 * Test suite for the nip operation implementation.
 * The nip operation removes the second element from the stack (NOS),
 * leaving only the top element.
 */

import { vm } from '../../../core/globalState';
import { nipOp } from '../../../ops/builtins-stack';
import { Tag, toTaggedValue } from '../../../core/tagged';
import { executeTacitCode, resetVM } from '../../utils/test-utils';

describe('nip Operation', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('simple values', () => {
    test('should remove second element with simple values', () => {
      vm.push(1); // Second element (will be removed)
      vm.push(2); // Top element (will remain)

      nipOp(vm);

      expect(vm.getStackData()).toEqual([2]);
    });

    test('should work with multiple simple values on stack', () => {
      vm.push(10); // Bottom element (will remain)
      vm.push(20); // Second element (will be removed)
      vm.push(30); // Top element (will remain)

      nipOp(vm);

      expect(vm.getStackData()).toEqual([10, 30]);
    });

    test('should work with negative numbers', () => {
      vm.push(-5.5); // Second element (will be removed)
      vm.push(3.14); // Top element (will remain)

      nipOp(vm);

      const result = vm.getStackData();
      expect(result.length).toBe(1);
      expect(result[0]).toBeCloseTo(3.14, 5);
    });

    test('should work with exactly two elements', () => {
      vm.push(100); // Second element (will be removed)
      vm.push(200); // Top element (will remain)

      nipOp(vm);

      expect(vm.getStackData()).toEqual([200]);
    });
  });

  describe('list operations', () => {
    test('should remove simple value under a list (keeping list)', () => {
      // Execute: 42 ( 10 20 ) nip
      // This should remove 42 and leave the list
      const stack = executeTacitCode('42 ( 10 20 ) nip');

      // Should only have the list remaining
      expect(stack).not.toContain(42);
      expect(stack).toContain(10);
      expect(stack).toContain(20);
    });

    test('should remove list under simple value (keeping simple value)', () => {
      // Execute: ( 99 88 ) 42 nip
      // This should remove the list and leave 42
      const stack = executeTacitCode('( 99 88 ) 42 nip');

      // Should only have the simple value remaining
      expect(stack).toEqual([42]);
    });

    test('should remove list under another list', () => {
      // Execute: ( 100 200 ) ( 300 400 ) nip
      // This should remove first list and leave second list
      const stack = executeTacitCode('( 100 200 ) ( 300 400 ) nip');

      // Should only have the second list remaining
      expect(stack).not.toContain(100);
      expect(stack).not.toContain(200);
      expect(stack).toContain(300);
      expect(stack).toContain(400);
    });

    test('should handle multi-element lists', () => {
      // Execute: ( 10 20 30 40 ) 999 nip
      // This should remove the large list and leave 999
      const stack = executeTacitCode('( 10 20 30 40 ) 999 nip');

      // Should only have the simple value remaining
      expect(stack).toEqual([999]);
    });

    test('should handle nested lists correctly', () => {
      // Execute: 123 ( 1 ( 2 3 ) 4 ) nip
      // This should remove 123 and leave the nested list
      const stack = executeTacitCode('123 ( 1 ( 2 3 ) 4 ) nip');

      // The result should be just the nested list structure
      expect(stack.length).toBeGreaterThan(0);
      expect(stack).not.toContain(123); // 123 should be removed
    });
  });

  describe('error cases', () => {
    test('should throw on stack underflow with empty stack', () => {
      expect(() => nipOp(vm)).toThrow();
    });

    test('should throw on stack underflow with only one element', () => {
      vm.push(42);
      expect(() => nipOp(vm)).toThrow();
    });

    test('should throw on stack underflow with only one list', () => {
      const listTag = toTaggedValue(1, Tag.LIST);
      const linkTag = toTaggedValue(2, Tag.LINK);

      vm.push(listTag);
      vm.push(42);
      vm.push(linkTag);

      expect(() => nipOp(vm)).toThrow();
    });
  });
});
