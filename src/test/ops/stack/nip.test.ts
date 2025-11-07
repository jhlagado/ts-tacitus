/**
 * @file src/test/ops/stack/nip.test.ts
 *
 * Test suite for the nip operation implementation.
 * The nip operation removes the second element from the stack (NOS),
 * leaving only the top element.
 */

import { vm } from '../../../lang/runtime';
import { nipOp } from '../../../ops/stack';
import { executeTacitCode, resetVM } from '../../utils/vm-test-utils';
import { push, getStackData } from '../../../core/vm';

describe('nip Operation', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('simple values', () => {
    test('should remove second element with simple values', () => {
      push(vm, 1);
      push(vm, 2);

      nipOp(vm);

      expect(getStackData(vm)).toEqual([2]);
    });

    test('should work with multiple simple values on stack', () => {
      push(vm, 10);
      push(vm, 20);
      push(vm, 30);

      nipOp(vm);

      expect(getStackData(vm)).toEqual([10, 30]);
    });

    test('should work with negative numbers', () => {
      push(vm, -5.5);
      push(vm, 3.14);

      nipOp(vm);

      const result = getStackData(vm);
      expect(result.length).toBe(1);
      expect(result[0]).toBeCloseTo(3.14, 5);
    });

    test('should work with exactly two elements', () => {
      push(vm, 100);
      push(vm, 200);

      nipOp(vm);

      expect(getStackData(vm)).toEqual([200]);
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
      expect(stack).toEqual([42]);
    });

    test('should remove list under another list', () => {
      const stack = executeTacitCode('( 100 200 ) ( 300 400 ) nip');
      expect(stack).not.toContain(100);
      expect(stack).not.toContain(200);
      expect(stack).toContain(300);
      expect(stack).toContain(400);
    });

    test('should handle multi-element lists', () => {
      const stack = executeTacitCode('( 10 20 30 40 ) 999 nip');
      expect(stack).toEqual([999]);
    });

    test('should handle nested lists correctly', () => {
      const stack = executeTacitCode('123 ( 1 ( 2 3 ) 4 ) nip');
      expect(stack.length).toBeGreaterThan(0);
      expect(stack).not.toContain(123);
    });
  });

  describe('error cases', () => {
    test('should throw on stack underflow with empty stack', () => {
      expect(() => nipOp(vm)).toThrow();
    });

    test('should throw on stack underflow with only one element', () => {
      push(vm, 42);
      expect(() => nipOp(vm)).toThrow();
    });

    test('should throw on stack underflow with only one list', () => {
      const stack = executeTacitCode('( 42 )');
      expect(stack.length).toBe(2);
      expect(() => nipOp(vm)).toThrow();
    });
  });
});
