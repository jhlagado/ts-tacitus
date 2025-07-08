import { VM } from '../core/vm';
import { initializeInterpreter, vm } from '../core/globalState';
import {
  mNegateOp,
  mReciprocalOp,
  mFloorOp,
  mNotOp,
  mSignumOp,
  mEnlistOp,
} from './builtins-unary-op';
describe('Built-in Unary Op Operations', () => {
  let testVM: VM;
  beforeEach(() => {
    initializeInterpreter();
    testVM = vm;
    testVM.debug = false;
  });
  describe('mNegateOp (negate)', () => {
    test('should negate a positive number', () => {
      testVM.push(5);
      mNegateOp(testVM);
      expect(testVM.pop()).toBe(-5);
    });
    test('should negate a negative number', () => {
      testVM.push(-10);
      mNegateOp(testVM);
      expect(testVM.pop()).toBe(10);
    });
    test('should handle zero', () => {
      testVM.push(0);
      mNegateOp(testVM);
      expect(testVM.pop()).toBe(-0);
    });
    test('should throw on stack underflow', () => {
      expect(() => mNegateOp(testVM)).toThrow('Stack underflow');
    });
  });
  describe('mReciprocalOp (reciprocal)', () => {
    test('should calculate reciprocal of a positive number', () => {
      testVM.push(5);
      mReciprocalOp(testVM);
      expect(testVM.pop()).toBeCloseTo(0.2);
    });
    test('should calculate reciprocal of a negative number', () => {
      testVM.push(-2);
      mReciprocalOp(testVM);
      expect(testVM.pop()).toBe(-0.5);
    });
    test('should handle division by zero', () => {
      testVM.push(0);
      mReciprocalOp(testVM);
      expect(testVM.pop()).toBe(Infinity);
    });
    test('should throw on stack underflow', () => {
      expect(() => mReciprocalOp(testVM)).toThrow('Stack underflow');
    });
  });
  describe('mFloorOp (floor)', () => {
    test('should floor a positive number', () => {
      testVM.push(5.7);
      mFloorOp(testVM);
      expect(testVM.pop()).toBe(5);
    });
    test('should floor a negative number', () => {
      testVM.push(-2.3);
      mFloorOp(testVM);
      expect(testVM.pop()).toBe(-3);
    });
    test('should handle whole numbers', () => {
      testVM.push(5);
      mFloorOp(testVM);
      expect(testVM.pop()).toBe(5);
    });
    test('should throw on stack underflow', () => {
      expect(() => mFloorOp(testVM)).toThrow('Stack underflow');
    });
  });
  describe('mNotOp (not)', () => {
    test('should return 1 for zero', () => {
      testVM.push(0);
      mNotOp(testVM);
      expect(testVM.pop()).toBe(1);
    });
    test('should return 0 for non-zero values', () => {
      testVM.push(5);
      mNotOp(testVM);
      expect(testVM.pop()).toBe(0);
    });
    test('should handle negative numbers', () => {
      testVM.push(-3);
      mNotOp(testVM);
      expect(testVM.pop()).toBe(0);
    });
    test('should throw on stack underflow', () => {
      expect(() => mNotOp(testVM)).toThrow('Stack underflow');
    });
  });
  describe('mSignumOp (signum)', () => {
    test('should return 1 for positive numbers', () => {
      testVM.push(5);
      mSignumOp(testVM);
      expect(testVM.pop()).toBe(1);
    });
    test('should return -1 for negative numbers', () => {
      testVM.push(-3);
      mSignumOp(testVM);
      expect(testVM.pop()).toBe(-1);
    });
    test('should return 0 for zero', () => {
      testVM.push(0);
      mSignumOp(testVM);
      expect(testVM.pop()).toBe(0);
    });
    test('should throw on stack underflow', () => {
      expect(() => mSignumOp(testVM)).toThrow('Stack underflow');
    });
  });
  describe('mEnlistOp (enlist)', () => {
    test('should throw on stack underflow', () => {
      expect(() => mEnlistOp(testVM)).toThrow('Stack underflow');
    });
  });
});
