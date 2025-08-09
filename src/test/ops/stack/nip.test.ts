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
      vm.push(1);
      vm.push(2);

      nipOp(vm);

      expect(vm.getStackData()).toEqual([2]);
    });

    test('should work with multiple simple values on stack', () => {
      vm.push(10);
      vm.push(20);
      vm.push(30);

      nipOp(vm);

      expect(vm.getStackData()).toEqual([10, 30]);
    });

    test('should work with negative numbers', () => {
      vm.push(-5.5);
      vm.push(3.14);

      nipOp(vm);

      const result = vm.getStackData();
      expect(result.length).toBe(1);
      expect(result[0]).toBeCloseTo(3.14, 5);
    });

    test('should work with exactly two elements', () => {
      vm.push(100);
      vm.push(200);

      nipOp(vm);

      expect(vm.getStackData()).toEqual([200]);
    });
  });

  describe('list operations (LIST semantics)', () => {
    test('should remove simple value under a list (keeping list)', () => {
      const stack = executeTacitCode('42 ( 10 20 ) nip');

      expect(stack).not.toContain(42);
      expect(stack).toContain(10);
      expect(stack).toContain(20);
    });

    test('should remove list under simple value (keeping simple value)', () => {
      const stack = executeTacitCode('( 99 88 ) 42 nip');
      // After removing the LIST (NOS), only 42 should remain
      expect(stack).toEqual([42]);
    });

    test('should remove list under another list', () => {
      const stack = executeTacitCode('( 100 200 ) ( 300 400 ) nip');
      // Remove NOS (the first list), leaving the top LIST only
      expect(stack).not.toContain(100);
      expect(stack).not.toContain(200);
      expect(stack).toContain(300);
      expect(stack).toContain(400);
    });

    test('should handle multi-element lists', () => {
      const stack = executeTacitCode('( 10 20 30 40 ) 999 nip');
      // Removing NOS (the list) should keep 999 only
      expect(stack).toEqual([999]);
    });

    test('should handle nested lists correctly', () => {
      const stack = executeTacitCode('123 ( 1 ( 2 3 ) 4 ) nip');
      // NOS is 123 here, so result should not contain 123
      expect(stack.length).toBeGreaterThan(0);
      expect(stack).not.toContain(123);
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
      const stack = executeTacitCode('( 42 )');
      expect(stack.length).toBe(2);
      expect(() => nipOp(vm)).toThrow();
    });
  });
});
