import { VM } from '../core/vm';
import { initializeInterpreter, vm } from '../core/globalState';
import {
  plusOp,
  minusOp,
  multiplyOp,
  divideOp,
  powerOp,
  modOp,
  minOp,
  maxOp,
  equalOp,
  lessThanOp,
  greaterThanOp,
  matchOp,
} from './builtins-math';

describe('Built-in Math Operations', () => {
  let testVM: VM;

  beforeEach(() => {
    initializeInterpreter();
    testVM = vm;
    testVM.debug = false;
  });

  describe('plusOp (+)', () => {
    it('should add two numbers correctly', () => {
      testVM.push(5);
      testVM.push(3);
      plusOp(testVM);
      expect(testVM.pop()).toBe(8);
    });

    it('should handle negative numbers', () => {
      testVM.push(-5);
      testVM.push(10);
      plusOp(testVM);
      expect(testVM.pop()).toBe(5);
    });

    it('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => plusOp(testVM)).toThrow('Stack underflow');
    });

    it('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(5);
      testVM.push(7);
      plusOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('plusOp', 5, 7);
      consoleSpy.mockRestore();
    });
  });

  describe('minusOp (-)', () => {
    it('should subtract two numbers correctly', () => {
      testVM.push(10);
      testVM.push(4);
      minusOp(testVM);
      expect(testVM.pop()).toBe(6);
    });

    it('should handle negative results', () => {
      testVM.push(5);
      testVM.push(10);
      minusOp(testVM);
      expect(testVM.pop()).toBe(-5);
    });

    it('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => minusOp(testVM)).toThrow('Stack underflow');
    });

    it('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(10);
      testVM.push(3);
      minusOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('minusOp', 10, 3);
      consoleSpy.mockRestore();
    });
  });

  describe('multiplyOp (*)', () => {
    it('should multiply two numbers correctly', () => {
      testVM.push(5);
      testVM.push(3);
      multiplyOp(testVM);
      expect(testVM.pop()).toBe(15);
    });

    it('should handle negative numbers', () => {
      testVM.push(-5);
      testVM.push(3);
      multiplyOp(testVM);
      expect(testVM.pop()).toBe(-15);
    });

    it('should handle zero', () => {
      testVM.push(5);
      testVM.push(0);
      multiplyOp(testVM);
      expect(testVM.pop()).toBe(0);
    });

    it('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => multiplyOp(testVM)).toThrow('Stack underflow');
    });

    it('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(6);
      testVM.push(7);
      multiplyOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('multiplyOp', 6, 7);
      consoleSpy.mockRestore();
    });
  });

  describe('divideOp (/)', () => {
    it('should divide two numbers correctly', () => {
      testVM.push(10);
      testVM.push(2);
      divideOp(testVM);
      expect(testVM.pop()).toBe(5);
    });

    it('should handle decimal results', () => {
      testVM.push(10);
      testVM.push(3);
      divideOp(testVM);
      expect(testVM.pop()).toBeCloseTo(3.33333, 4);
    });

    it('should handle negative numbers', () => {
      testVM.push(-10);
      testVM.push(2);
      divideOp(testVM);
      expect(testVM.pop()).toBe(-5);
    });

    it('should handle division by zero', () => {
      testVM.push(5);
      testVM.push(0);
      divideOp(testVM);
      expect(testVM.pop()).toBe(Infinity);
    });

    it('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => divideOp(testVM)).toThrow('Stack underflow');
    });

    it('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(20);
      testVM.push(4);
      divideOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('divideOp', 20, 4);
      consoleSpy.mockRestore();
    });
  });

  describe('powerOp (^)', () => {
    it('should calculate power correctly', () => {
      testVM.push(2);
      testVM.push(3);
      powerOp(testVM);
      expect(testVM.pop()).toBe(8);
    });

    it('should handle fractional exponents', () => {
      testVM.push(4);
      testVM.push(0.5);
      powerOp(testVM);
      expect(testVM.pop()).toBe(2);
    });

    it('should handle negative base', () => {
      testVM.push(-2);
      testVM.push(2);
      powerOp(testVM);
      expect(testVM.pop()).toBe(4);
    });

    it('should handle zero base', () => {
      testVM.push(0);
      testVM.push(5);
      powerOp(testVM);
      expect(testVM.pop()).toBe(0);
    });

    it('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => powerOp(testVM)).toThrow('Stack underflow');
    });

    it('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(3);
      testVM.push(2);
      powerOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('powerOp', 3, 2);
      consoleSpy.mockRestore();
    });
  });

  describe('modOp (%)', () => {
    it('should calculate modulo correctly', () => {
      testVM.push(10);
      testVM.push(3);
      modOp(testVM);
      expect(testVM.pop()).toBe(1);
    });

    it('should handle negative numbers', () => {
      testVM.push(-10);
      testVM.push(3);
      modOp(testVM);
      expect(testVM.pop()).toBe(-1);
    });

    it('should handle zero modulus', () => {
      testVM.push(5);
      testVM.push(0);
      modOp(testVM);
      expect(testVM.pop()).toBeNaN();
    });

    it('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => modOp(testVM)).toThrow('Stack underflow');
    });

    it('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(17);
      testVM.push(5);
      modOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('modOp', 17, 5);
      consoleSpy.mockRestore();
    });
  });

  describe('minOp (min)', () => {
    it('should return the smaller value', () => {
      testVM.push(5);
      testVM.push(10);
      minOp(testVM);
      expect(testVM.pop()).toBe(5);
    });

    it('should handle negative numbers', () => {
      testVM.push(-5);
      testVM.push(10);
      minOp(testVM);
      expect(testVM.pop()).toBe(-5);
    });

    it('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => minOp(testVM)).toThrow('Stack underflow');
    });

    it('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(3);
      testVM.push(8);
      minOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('minOp', 3, 8);
      consoleSpy.mockRestore();
    });
  });

  describe('maxOp (max)', () => {
    it('should return the larger value', () => {
      testVM.push(5);
      testVM.push(10);
      maxOp(testVM);
      expect(testVM.pop()).toBe(10);
    });

    it('should handle negative numbers', () => {
      testVM.push(-5);
      testVM.push(-10);
      maxOp(testVM);
      expect(testVM.pop()).toBe(-5);
    });

    it('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => maxOp(testVM)).toThrow('Stack underflow');
    });

    it('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(3);
      testVM.push(8);
      maxOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('maxOp', 3, 8);
      consoleSpy.mockRestore();
    });
  });

  describe('equalOp (=)', () => {
    it('should return 1 for equal values', () => {
      testVM.push(5);
      testVM.push(5);
      equalOp(testVM);
      expect(testVM.pop()).toBe(1);
    });

    it('should return 0 for unequal values', () => {
      testVM.push(5);
      testVM.push(10);
      equalOp(testVM);
      expect(testVM.pop()).toBe(0);
    });

    it('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => equalOp(testVM)).toThrow('Stack underflow');
    });

    it('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(7);
      testVM.push(7);
      equalOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('equalOp', 7, 7);
      consoleSpy.mockRestore();
    });
  });

  describe('lessThanOp (<)', () => {
    it('should return 1 when a < b', () => {
      testVM.push(5);
      testVM.push(10);
      lessThanOp(testVM);
      expect(testVM.pop()).toBe(1);
    });

    it('should return 0 when a >= b', () => {
      testVM.push(10);
      testVM.push(5);
      lessThanOp(testVM);
      expect(testVM.pop()).toBe(0);
    });

    it('should handle equal values', () => {
      testVM.push(5);
      testVM.push(5);
      lessThanOp(testVM);
      expect(testVM.pop()).toBe(0);
    });

    it('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => lessThanOp(testVM)).toThrow('Stack underflow');
    });

    it('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(3);
      testVM.push(8);
      lessThanOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('lessThanOp', 3, 8);
      consoleSpy.mockRestore();
    });
  });

  describe('greaterThanOp (>)', () => {
    it('should return 1 when a > b', () => {
      testVM.push(10);
      testVM.push(5);
      greaterThanOp(testVM);
      expect(testVM.pop()).toBe(1);
    });

    it('should return 0 when a <= b', () => {
      testVM.push(5);
      testVM.push(10);
      greaterThanOp(testVM);
      expect(testVM.pop()).toBe(0);
    });

    it('should handle equal values', () => {
      testVM.push(5);
      testVM.push(5);
      greaterThanOp(testVM);
      expect(testVM.pop()).toBe(0);
    });

    it('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => greaterThanOp(testVM)).toThrow('Stack underflow');
    });

    it('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(8);
      testVM.push(3);
      greaterThanOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('greaterThanOp', 8, 3);
      consoleSpy.mockRestore();
    });
  });

  describe('matchOp (~)', () => {
    it('should return 1 for matching values', () => {
      testVM.push(5);
      testVM.push(5);
      matchOp(testVM);
      expect(testVM.pop()).toBe(1);
    });

    it('should return 0 for non-matching values', () => {
      testVM.push(5);
      testVM.push(10);
      matchOp(testVM);
      expect(testVM.pop()).toBe(0);
    });

    it('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => matchOp(testVM)).toThrow('Stack underflow');
    });

    it('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(7);
      testVM.push(7);
      matchOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('matchOp', 7, 7);
      consoleSpy.mockRestore();
    });
  });
});
