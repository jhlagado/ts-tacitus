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

  describe('simple values', () => {
    test('equal - should return 1 for equal values', () => {
      push(vm, 5);
      push(vm, 5);
      equalOp(vm);
      expect(pop(vm)).toBe(1);
    });

    test('equal - should return 0 for unequal values', () => {
      push(vm, 5);
      push(vm, 6);
      equalOp(vm);
      expect(pop(vm)).toBe(0);
    });

    test('equal - should handle negative numbers', () => {
      push(vm, -3);
      push(vm, -3);
      equalOp(vm);
      expect(pop(vm)).toBe(1);
    });

    test('equal - should handle zero', () => {
      push(vm, 0);
      push(vm, 0);
      equalOp(vm);
      expect(pop(vm)).toBe(1);
    });

    test('less than - should return 1 when a < b', () => {
      push(vm, 5);
      push(vm, 10);
      lessThanOp(vm);
      expect(pop(vm)).toBe(1);
    });

    test('less than - should return 0 when a >= b', () => {
      push(vm, 10);
      push(vm, 5);
      lessThanOp(vm);
      expect(pop(vm)).toBe(0);
    });

    test('less than - should handle equal values', () => {
      push(vm, 5);
      push(vm, 5);
      lessThanOp(vm);
      expect(pop(vm)).toBe(0);
    });

    test('less than - should handle negative numbers', () => {
      push(vm, -10);
      push(vm, -5);
      lessThanOp(vm);
      expect(pop(vm)).toBe(1);
    });

    test('greater than - should return 1 when a > b', () => {
      push(vm, 10);
      push(vm, 5);
      greaterThanOp(vm);
      expect(pop(vm)).toBe(1);
    });

    test('greater than - should return 0 when a <= b', () => {
      push(vm, 5);
      push(vm, 10);
      greaterThanOp(vm);
      expect(pop(vm)).toBe(0);
    });

    test('greater than - should handle equal values', () => {
      push(vm, 5);
      push(vm, 5);
      greaterThanOp(vm);
      expect(pop(vm)).toBe(0);
    });

    test('greater than - should handle negative numbers', () => {
      push(vm, -5);
      push(vm, -10);
      greaterThanOp(vm);
      expect(pop(vm)).toBe(1);
    });

    test('less than or equal - should return 1 when a <= b', () => {
      push(vm, 5);
      push(vm, 10);
      lessOrEqualOp(vm);
      expect(pop(vm)).toBe(1);
    });

    test('less than or equal - should return 1 when a == b', () => {
      push(vm, 5);
      push(vm, 5);
      lessOrEqualOp(vm);
      expect(pop(vm)).toBe(1);
    });

    test('less than or equal - should return 0 when a > b', () => {
      push(vm, 10);
      push(vm, 5);
      lessOrEqualOp(vm);
      expect(pop(vm)).toBe(0);
    });

    test('greater than or equal - should return 1 when a >= b', () => {
      push(vm, 10);
      push(vm, 5);
      greaterOrEqualOp(vm);
      expect(pop(vm)).toBe(1);
    });

    test('greater than or equal - should return 1 when a == b', () => {
      push(vm, 5);
      push(vm, 5);
      greaterOrEqualOp(vm);
      expect(pop(vm)).toBe(1);
    });

    test('greater than or equal - should return 0 when a < b', () => {
      push(vm, 5);
      push(vm, 10);
      greaterOrEqualOp(vm);
      expect(pop(vm)).toBe(0);
    });
  });

  describe('list operations', () => {});

  describe('error cases', () => {
    test('equal - should throw on stack underflow', () => {
      push(vm, 5);
      expect(() => equalOp(vm)).toThrow('Stack underflow');
    });

    test('less than - should throw on stack underflow', () => {
      push(vm, 5);
      expect(() => lessThanOp(vm)).toThrow('Stack underflow');
    });

    test('greater than - should throw on stack underflow', () => {
      push(vm, 5);
      expect(() => greaterThanOp(vm)).toThrow('Stack underflow');
    });

    test('less than or equal - should throw on stack underflow', () => {
      push(vm, 5);
      expect(() => lessOrEqualOp(vm)).toThrow('Stack underflow');
    });

    test('greater than or equal - should throw on stack underflow', () => {
      push(vm, 5);
      expect(() => greaterOrEqualOp(vm)).toThrow('Stack underflow');
    });
  });
});
