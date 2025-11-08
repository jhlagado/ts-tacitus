/*
Tests for comparison operations - Tacit's relational operators
All operations work on stack values and return 1 (true) or 0 (false)
*/
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../../core';
import { push, pop } from '../../../core/vm';
import {
  equalOp,
  lessThanOp,
  greaterThanOp,
  lessOrEqualOp,
  greaterOrEqualOp,
} from '../../../ops/math';

describe('Comparison Operations', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('basic operations', () => {
    test('equal - returns 1 for equal, 0 for unequal', () => {
      push(vm, 5);
      push(vm, 5);
      equalOp(vm);
      expect(pop(vm)).toBe(1);

      vm = createVM();
      push(vm, 5);
      push(vm, 6);
      equalOp(vm);
      expect(pop(vm)).toBe(0);
    });

    test('less than - returns 1 when a < b, 0 otherwise', () => {
      push(vm, 5);
      push(vm, 10);
      lessThanOp(vm);
      expect(pop(vm)).toBe(1);

      vm = createVM();
      push(vm, 10);
      push(vm, 5);
      lessThanOp(vm);
      expect(pop(vm)).toBe(0);

      vm = createVM();
      push(vm, 5);
      push(vm, 5);
      lessThanOp(vm);
      expect(pop(vm)).toBe(0);
    });

    test('greater than - returns 1 when a > b, 0 otherwise', () => {
      push(vm, 10);
      push(vm, 5);
      greaterThanOp(vm);
      expect(pop(vm)).toBe(1);

      vm = createVM();
      push(vm, 5);
      push(vm, 10);
      greaterThanOp(vm);
      expect(pop(vm)).toBe(0);

      vm = createVM();
      push(vm, 5);
      push(vm, 5);
      greaterThanOp(vm);
      expect(pop(vm)).toBe(0);
    });

    test('less than or equal - returns 1 when a <= b, 0 otherwise', () => {
      push(vm, 5);
      push(vm, 10);
      lessOrEqualOp(vm);
      expect(pop(vm)).toBe(1);

      vm = createVM();
      push(vm, 5);
      push(vm, 5);
      lessOrEqualOp(vm);
      expect(pop(vm)).toBe(1);

      vm = createVM();
      push(vm, 10);
      push(vm, 5);
      lessOrEqualOp(vm);
      expect(pop(vm)).toBe(0);
    });

    test('greater than or equal - returns 1 when a >= b, 0 otherwise', () => {
      push(vm, 10);
      push(vm, 5);
      greaterOrEqualOp(vm);
      expect(pop(vm)).toBe(1);

      vm = createVM();
      push(vm, 5);
      push(vm, 5);
      greaterOrEqualOp(vm);
      expect(pop(vm)).toBe(1);

      vm = createVM();
      push(vm, 5);
      push(vm, 10);
      greaterOrEqualOp(vm);
      expect(pop(vm)).toBe(0);
    });
  });

  describe('edge cases', () => {
    test('handles negative numbers correctly', () => {
      const ops = [
        { op: equalOp, a: -3, b: -3, expected: 1 },
        { op: lessThanOp, a: -10, b: -5, expected: 1 },
        { op: greaterThanOp, a: -5, b: -10, expected: 1 },
      ];

      ops.forEach(({ op, a, b, expected }) => {
        vm = createVM();
        push(vm, a);
        push(vm, b);
        op(vm);
        expect(pop(vm)).toBe(expected);
      });
    });

    test('handles zero correctly', () => {
      vm = createVM();
      push(vm, 0);
      push(vm, 0);
      equalOp(vm);
      expect(pop(vm)).toBe(1);

      vm = createVM();
      push(vm, 0);
      push(vm, 5);
      lessThanOp(vm);
      expect(pop(vm)).toBe(1);
    });
  });

  describe('error cases', () => {
    test('should throw on stack underflow', () => {
      const ops = [
        { op: equalOp, name: 'equal' },
        { op: lessThanOp, name: 'lessThan' },
        { op: greaterThanOp, name: 'greaterThan' },
        { op: lessOrEqualOp, name: 'lessOrEqual' },
        { op: greaterOrEqualOp, name: 'greaterOrEqual' },
      ];

      ops.forEach(({ op, name }) => {
        vm = createVM();
      push(vm, 5);
        expect(() => op(vm)).toThrow('Stack underflow');
    });
    });
  });
});
