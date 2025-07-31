/*
Tests for unary operations - TACIT's single-operand mathematical operations
Includes negate, reciprocal, floor, not, signum, and enlist operations
*/
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../core/globalState';
import {
  mNegateOp,
  mReciprocalOp,
  mFloorOp,
  mNotOp,
  mSignumOp,
  mEnlistOp,
} from '../../ops/builtins-unary-op';

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
      mNegateOp(vm);
      expect(vm.pop()).toBe(-5);
    });

    test('should negate a negative number', () => {
      vm.push(-10);
      mNegateOp(vm);
      expect(vm.pop()).toBe(10);
    });

    test('should negate zero', () => {
      vm.push(0);
      mNegateOp(vm);
      expect(vm.pop()).toBe(-0);
    });

    test('should calculate reciprocal of positive number', () => {
      vm.push(5);
      mReciprocalOp(vm);
      expect(vm.pop()).toBeCloseTo(0.2);
    });

    test('should calculate reciprocal of negative number', () => {
      vm.push(-2);
      mReciprocalOp(vm);
      expect(vm.pop()).toBe(-0.5);
    });

    test('should handle reciprocal division by zero', () => {
      vm.push(0);
      mReciprocalOp(vm);
      expect(vm.pop()).toBe(Infinity);
    });

    test('should floor positive numbers', () => {
      vm.push(5.7);
      mFloorOp(vm);
      expect(vm.pop()).toBe(5);
    });

    test('should floor negative numbers', () => {
      vm.push(-2.3);
      mFloorOp(vm);
      expect(vm.pop()).toBe(-3);
    });

    test('should floor whole numbers unchanged', () => {
      vm.push(5);
      mFloorOp(vm);
      expect(vm.pop()).toBe(5);
    });

    test('should return 1 for logical not of zero', () => {
      vm.push(0);
      mNotOp(vm);
      expect(vm.pop()).toBe(1);
    });

    test('should return 0 for logical not of non-zero values', () => {
      vm.push(5);
      mNotOp(vm);
      expect(vm.pop()).toBe(0);
    });

    test('should return 0 for logical not of negative numbers', () => {
      vm.push(-3);
      mNotOp(vm);
      expect(vm.pop()).toBe(0);
    });

    test('should return 1 for signum of positive numbers', () => {
      vm.push(5);
      mSignumOp(vm);
      expect(vm.pop()).toBe(1);
    });

    test('should return -1 for signum of negative numbers', () => {
      vm.push(-3);
      mSignumOp(vm);
      expect(vm.pop()).toBe(-1);
    });

    test('should return 0 for signum of zero', () => {
      vm.push(0);
      mSignumOp(vm);
      expect(vm.pop()).toBe(0);
    });
  });

  describe('list operations', () => {
    // TODO: Add list-specific unary operation tests when list operations are implemented
  });

  describe('error cases', () => {
    test('should throw on negate stack underflow', () => {
      expect(() => mNegateOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on reciprocal stack underflow', () => {
      expect(() => mReciprocalOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on floor stack underflow', () => {
      expect(() => mFloorOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on not stack underflow', () => {
      expect(() => mNotOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on signum stack underflow', () => {
      expect(() => mSignumOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on enlist stack underflow', () => {
      expect(() => mEnlistOp(vm)).toThrow('Stack underflow');
    });
  });
});
