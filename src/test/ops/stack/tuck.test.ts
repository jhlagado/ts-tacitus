/**
 * @file src/test/ops/stack/tuck.test.ts
 *
 * Test suite for the tuck operation implementation.
 * The tuck operation duplicates the top element and inserts the copy
 * under the second element.
 */

import { createVM, type VM } from '../../../core/vm';
import { tuckOp } from '../../../ops/stack';
import { push, getStackData } from '../../../core/vm';
import { Tag, Tagged } from '../../../core/tagged';
import { executeTacitCode } from '../../utils/vm-test-utils';

describe('tuck Operation', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('simple values', () => {
    test('should duplicate top element under second with simple values', () => {
      push(vm, 1);
      push(vm, 2);

      tuckOp(vm);

      expect(getStackData(vm)).toEqual([2, 1, 2]);
    });

    test('should work with multiple simple values on stack', () => {
      push(vm, 10);
      push(vm, 20);
      push(vm, 30);

      tuckOp(vm);

      expect(getStackData(vm)).toEqual([10, 30, 20, 30]);
    });

    test('should work with negative numbers', () => {
      push(vm, -5.5);
      push(vm, 3.14);

      tuckOp(vm);

      const result = getStackData(vm);
      expect(result.length).toBe(3);
      expect(result[0]).toBeCloseTo(3.14, 5);
      expect(result[1]).toBeCloseTo(-5.5, 5);
      expect(result[2]).toBeCloseTo(3.14, 5);
    });

    test('should work with exactly two elements', () => {
      push(vm, 100);
      push(vm, 200);

      tuckOp(vm);

      expect(getStackData(vm)).toEqual([200, 100, 200]);
    });
  });

  describe('list operations (LIST semantics)', () => {
    test('should duplicate simple value under a list', () => {
      const stack = executeTacitCode(vm, '( 10 20 ) 42 tuck');

      expect(stack.filter(x => x === 42).length).toBe(2);
      expect(stack).toContain(10);
      expect(stack).toContain(20);
    });

    test('should duplicate list under simple value', () => {
      const stack = executeTacitCode(vm, '42 ( 99 88 ) tuck');

      expect(stack).toContain(42);
      expect(stack).toContain(99);
      expect(stack).toContain(88);
      expect(stack.filter(x => x === 99).length).toBeGreaterThanOrEqual(2);
      expect(stack.filter(x => x === 88).length).toBeGreaterThanOrEqual(2);
    });

    test('should duplicate list under another list', () => {
      const stack = executeTacitCode(vm, '( 100 200 ) ( 300 400 ) tuck');
      expect(stack).toContain(100);
      expect(stack).toContain(200);
      expect(stack).toContain(300);
      expect(stack).toContain(400);
      expect(stack.filter(x => x === 300).length).toBeGreaterThanOrEqual(2);
      expect(stack.filter(x => x === 400).length).toBeGreaterThanOrEqual(2);
    });

    test('should handle multi-element lists', () => {
      const stack = executeTacitCode(vm, '999 ( 10 20 30 40 ) tuck');
      expect(stack).toContain(999);
      for (const v of [10, 20, 30, 40]) {
        expect(stack).toContain(v);
        expect(stack.filter(x => x === v).length).toBeGreaterThanOrEqual(2);
      }
    });

    test('should handle nested lists correctly', () => {
      const stack = executeTacitCode(vm, '( 1 ( 2 3 ) 4 ) 123 tuck');
      for (const v of [1, 2, 3, 4]) expect(stack).toContain(v);
      expect(stack.filter(x => x === 123).length).toBe(2);
    });
  });

  describe('error cases', () => {
    test('should throw on stack underflow with empty stack', () => {
      expect(() => tuckOp(vm)).toThrow();
    });

    test('should throw on stack underflow with only one element', () => {
      push(vm, 42);
      expect(() => tuckOp(vm)).toThrow();
    });

    test('should throw on stack underflow with only one list', () => {
      push(vm, 42);
      push(vm, Tagged(1, Tag.LIST));
      expect(() => tuckOp(vm)).toThrow();
    });
  });
});
