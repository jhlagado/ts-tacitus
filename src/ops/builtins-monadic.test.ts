import { VM } from '../core/vm';
import { initializeInterpreter, vm } from '../core/globalState';
import {
  mNegateOp,
  mReciprocalOp,
  mFloorOp,
  mNotOp,
  mSignumOp,
  mEnlistOp,
} from './builtins-monadic';
import { toFloat32 } from '../core/utils';

describe('Built-in Monadic Operations', () => {
  let testVM: VM;

  beforeEach(() => {
    initializeInterpreter();
    testVM = vm;
    testVM.debug = false;
  });

  describe('mNegateOp (m-)', () => {
    it('should negate a positive number', () => {
      testVM.push(5);
      mNegateOp(testVM);
      expect(testVM.pop()).toBe(-5);
    });

    it('should negate a negative number', () => {
      testVM.push(-10);
      mNegateOp(testVM);
      expect(testVM.pop()).toBe(10);
    });

    it('should handle zero', () => {
      testVM.push(0);
      mNegateOp(testVM);
      expect(testVM.pop()).toBe(-0); // JavaScript has negative zero
    });

    it('should throw on stack underflow', () => {
      expect(() => mNegateOp(testVM)).toThrow('Stack underflow');
    });

    it('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(7);
      mNegateOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('mNegateOp', 7);
      consoleSpy.mockRestore();
    });
  });

  describe('mReciprocalOp (m%)', () => {
    it('should calculate reciprocal of a positive number', () => {
      testVM.push(5);
      mReciprocalOp(testVM);
      expect(testVM.pop()).toBeCloseTo(0.2);
    });

    it('should calculate reciprocal of a negative number', () => {
      testVM.push(-2);
      mReciprocalOp(testVM);
      expect(testVM.pop()).toBe(-0.5);
    });

    it('should handle division by zero', () => {
      testVM.push(0);
      mReciprocalOp(testVM);
      expect(testVM.pop()).toBe(Infinity);
    });

    it('should throw on stack underflow', () => {
      expect(() => mReciprocalOp(testVM)).toThrow('Stack underflow');
    });

    it('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(10);
      mReciprocalOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('mReciprocalOp', 10);
      consoleSpy.mockRestore();
    });
  });

  describe('mFloorOp (m_)', () => {
    it('should floor a positive number', () => {
      testVM.push(5.7);
      mFloorOp(testVM);
      expect(testVM.pop()).toBe(5);
    });

    it('should floor a negative number', () => {
      testVM.push(-2.3);
      mFloorOp(testVM);
      expect(testVM.pop()).toBe(-3);
    });

    it('should handle whole numbers', () => {
      testVM.push(5);
      mFloorOp(testVM);
      expect(testVM.pop()).toBe(5);
    });

    it('should throw on stack underflow', () => {
      expect(() => mFloorOp(testVM)).toThrow('Stack underflow');
    });

    it('should log when debug is enabled', () => {
      const num = toFloat32(3.7);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(num);
      mFloorOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('mFloorOp', num);
      consoleSpy.mockRestore();
    });
  });

  describe('mNotOp (m~)', () => {
    it('should return 1 for zero', () => {
      testVM.push(0);
      mNotOp(testVM);
      expect(testVM.pop()).toBe(1);
    });

    it('should return 0 for non-zero values', () => {
      testVM.push(5);
      mNotOp(testVM);
      expect(testVM.pop()).toBe(0);
    });

    it('should handle negative numbers', () => {
      testVM.push(-3);
      mNotOp(testVM);
      expect(testVM.pop()).toBe(0);
    });

    it('should throw on stack underflow', () => {
      expect(() => mNotOp(testVM)).toThrow('Stack underflow');
    });

    it('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(0);
      mNotOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('mNotOp', 0);
      consoleSpy.mockRestore();
    });
  });

  describe('mSignumOp (m*)', () => {
    it('should return 1 for positive numbers', () => {
      testVM.push(5);
      mSignumOp(testVM);
      expect(testVM.pop()).toBe(1);
    });

    it('should return -1 for negative numbers', () => {
      testVM.push(-3);
      mSignumOp(testVM);
      expect(testVM.pop()).toBe(-1);
    });

    it('should return 0 for zero', () => {
      testVM.push(0);
      mSignumOp(testVM);
      expect(testVM.pop()).toBe(0);
    });

    it('should throw on stack underflow', () => {
      expect(() => mSignumOp(testVM)).toThrow('Stack underflow');
    });

    it('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(42);
      mSignumOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('mSignumOp', 42);
      consoleSpy.mockRestore();
    });
  });

  describe('mEnlistOp (m,)', () => {
    it('should throw on stack underflow', () => {
      expect(() => mEnlistOp(testVM)).toThrow('Stack underflow');
    });

    it('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(7);

      // Currently mEnlistOp does nothing except remove the value, as list support is not implemented
      // This test just verifies that the debug log works
      mEnlistOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('mEnlistOp', 7);
      consoleSpy.mockRestore();
    });
  });
});
