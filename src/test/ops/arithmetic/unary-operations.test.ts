/*
Tests for unary operations - Tacit's single-operand mathematical operations
Includes negate, reciprocal, floor, not, signum, and enlist operations
*/
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../utils/vm-test-utils';
import { negOp, recipOp, floorOp, notOp, signOp } from '../../../ops/math';
import { enlistOp } from '../../../ops/lists';
import { pop, push } from '../../../core/vm';

function resetVM(): void {
  initializeInterpreter();
  vm.debug = false;
}

describe('Unary Operations', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('simple values', () => {
    test('should negate a positive number', () => {
      push(vm, 5);
      negOp(vm);
      expect(pop(vm)).toBe(-5);
    });

    test('should negate a negative number', () => {
      push(vm, -10);
      negOp(vm);
      expect(pop(vm)).toBe(10);
    });

    test('should negate zero', () => {
      push(vm, 0);
      negOp(vm);
      expect(pop(vm)).toBe(-0);
    });

    test('should calculate reciprocal of positive number', () => {
      push(vm, 5);
      recipOp(vm);
      expect(pop(vm)).toBeCloseTo(0.2);
    });

    test('should calculate reciprocal of negative number', () => {
      push(vm, -2);
      recipOp(vm);
      expect(pop(vm)).toBe(-0.5);
    });

    test('should handle reciprocal division by zero', () => {
      push(vm, 0);
      recipOp(vm);
      expect(pop(vm)).toBe(Infinity);
    });

    test('should floor positive numbers', () => {
      push(vm, 5.7);
      floorOp(vm);
      expect(pop(vm)).toBe(5);
    });

    test('should floor negative numbers', () => {
      push(vm, -2.3);
      floorOp(vm);
      expect(pop(vm)).toBe(-3);
    });

    test('should floor whole numbers unchanged', () => {
      push(vm, 5);
      floorOp(vm);
      expect(pop(vm)).toBe(5);
    });

    test('should return 1 for logical not of zero', () => {
      push(vm, 0);
      notOp(vm);
      expect(pop(vm)).toBe(1);
    });

    test('should return 0 for logical not of non-zero values', () => {
      push(vm, 5);
      notOp(vm);
      expect(pop(vm)).toBe(0);
    });

    test('should return 0 for logical not of negative numbers', () => {
      push(vm, -3);
      notOp(vm);
      expect(pop(vm)).toBe(0);
    });

    test('should return 1 for signum of positive numbers', () => {
      push(vm, 5);
      signOp(vm);
      expect(pop(vm)).toBe(1);
    });

    test('should return -1 for signum of negative numbers', () => {
      push(vm, -3);
      signOp(vm);
      expect(pop(vm)).toBe(-1);
    });

    test('should return 0 for signum of zero', () => {
      push(vm, 0);
      signOp(vm);
      expect(pop(vm)).toBe(0);
    });
  });

  describe('list operations', () => {});

  describe('error cases', () => {
    test('should throw on negate stack underflow', () => {
      expect(() => negOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on reciprocal stack underflow', () => {
      expect(() => recipOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on floor stack underflow', () => {
      expect(() => floorOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on not stack underflow', () => {
      expect(() => notOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on signum stack underflow', () => {
      expect(() => signOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on enlist stack underflow', () => {
      expect(() => enlistOp(vm)).toThrow('Stack underflow');
    });
  });
});
