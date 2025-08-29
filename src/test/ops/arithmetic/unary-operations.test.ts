/*
Tests for unary operations - TACIT's single-operand mathematical operations
Includes negate, reciprocal, floor, not, signum, and enlist operations
*/
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../../core/globalState';
import { negOp, recipOp, floorOp, notOp, signOp } from '../../../ops/math-ops';
import { mEnlistOp } from '../../../ops/list-ops';

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
      vm.push(5);
      negOp(vm);
      expect(vm.pop()).toBe(-5);
    });

    test('should negate a negative number', () => {
      vm.push(-10);
      negOp(vm);
      expect(vm.pop()).toBe(10);
    });

    test('should negate zero', () => {
      vm.push(0);
      negOp(vm);
      expect(vm.pop()).toBe(-0);
    });

    test('should calculate reciprocal of positive number', () => {
      vm.push(5);
      recipOp(vm);
      expect(vm.pop()).toBeCloseTo(0.2);
    });

    test('should calculate reciprocal of negative number', () => {
      vm.push(-2);
      recipOp(vm);
      expect(vm.pop()).toBe(-0.5);
    });

    test('should handle reciprocal division by zero', () => {
      vm.push(0);
      recipOp(vm);
      expect(vm.pop()).toBe(Infinity);
    });

    test('should floor positive numbers', () => {
      vm.push(5.7);
      floorOp(vm);
      expect(vm.pop()).toBe(5);
    });

    test('should floor negative numbers', () => {
      vm.push(-2.3);
      floorOp(vm);
      expect(vm.pop()).toBe(-3);
    });

    test('should floor whole numbers unchanged', () => {
      vm.push(5);
      floorOp(vm);
      expect(vm.pop()).toBe(5);
    });

    test('should return 1 for logical not of zero', () => {
      vm.push(0);
      notOp(vm);
      expect(vm.pop()).toBe(1);
    });

    test('should return 0 for logical not of non-zero values', () => {
      vm.push(5);
      notOp(vm);
      expect(vm.pop()).toBe(0);
    });

    test('should return 0 for logical not of negative numbers', () => {
      vm.push(-3);
      notOp(vm);
      expect(vm.pop()).toBe(0);
    });

    test('should return 1 for signum of positive numbers', () => {
      vm.push(5);
      signOp(vm);
      expect(vm.pop()).toBe(1);
    });

    test('should return -1 for signum of negative numbers', () => {
      vm.push(-3);
      signOp(vm);
      expect(vm.pop()).toBe(-1);
    });

    test('should return 0 for signum of zero', () => {
      vm.push(0);
      signOp(vm);
      expect(vm.pop()).toBe(0);
    });
  });

  describe('list operations', () => {
  });

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
      expect(() => mEnlistOp(vm)).toThrow('Stack underflow');
    });
  });
});
