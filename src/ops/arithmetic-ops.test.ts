import { VM } from '../core/vm';
import { initializeInterpreter, vm } from '../core/globalState';

import {
  absOp,
  negOp,
  signOp,
  expOp,
  lnOp,
  logOp,
  sqrtOp,
  powOp,
  minOp,
  maxOp,
  avgOp,
  prodOp,
} from './arithmetic-ops';
describe('Arithmetic Operations', () => {
  let testVM: VM;
  beforeEach(() => {
    initializeInterpreter();
    testVM = vm;
    testVM.debug = false;
  });
  describe('absOp', () => {
    test('should return the absolute value of a number', () => {
      testVM.push(-5);
      absOp(testVM);
      expect(testVM.pop()).toBe(5);
    });
    test('should return the same value for positive numbers', () => {
      testVM.push(10);
      absOp(testVM);
      expect(testVM.pop()).toBe(10);
    });
    test('should handle zero', () => {
      testVM.push(0);
      absOp(testVM);
      expect(testVM.pop()).toBe(0);
    });
    test('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(-7);
      absOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('absOp', -7);
      consoleSpy.mockRestore();
    });
  });
  describe('negOp', () => {
    test('should negate a positive number', () => {
      testVM.push(5);
      negOp(testVM);
      expect(testVM.pop()).toBe(-5);
    });
    test('should negate a negative number', () => {
      testVM.push(-10);
      negOp(testVM);
      expect(testVM.pop()).toBe(10);
    });
    test('should handle zero', () => {
      testVM.push(0);
      negOp(testVM);
      expect(testVM.pop()).toBe(-0);
    });
    test('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(7);
      negOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('negOp', 7);
      consoleSpy.mockRestore();
    });
  });
  describe('signOp', () => {
    test('should return 1 for positive numbers', () => {
      testVM.push(5);
      signOp(testVM);
      expect(testVM.pop()).toBe(1);
    });
    test('should return -1 for negative numbers', () => {
      testVM.push(-10);
      signOp(testVM);
      expect(testVM.pop()).toBe(-1);
    });
    test('should return 0 for zero', () => {
      testVM.push(0);
      signOp(testVM);
      expect(testVM.pop()).toBe(0);
    });
    test('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(-3);
      signOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('signOp', -3);
      consoleSpy.mockRestore();
    });
  });
  describe('expOp', () => {
    test('should calculate e^x for positive numbers', () => {
      testVM.push(1);
      expOp(testVM);
      expect(testVM.pop()).toBeCloseTo(Math.E, 5);
    });
    test('should calculate e^x for negative numbers', () => {
      testVM.push(-1);
      expOp(testVM);
      expect(testVM.pop()).toBeCloseTo(1 / Math.E, 5);
    });
    test('should handle zero', () => {
      testVM.push(0);
      expOp(testVM);
      expect(testVM.pop()).toBe(1);
    });
    test('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(2);
      expOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('expOp', 2);
      consoleSpy.mockRestore();
    });
  });
  describe('lnOp', () => {
    test('should calculate natural log for positive numbers', () => {
      testVM.push(Math.E);
      lnOp(testVM);
      expect(testVM.pop()).toBeCloseTo(1, 5);
    });
    test('should return Infinity for zero', () => {
      testVM.push(0);
      lnOp(testVM);
      expect(testVM.pop()).toBe(-Infinity);
    });
    test('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(10);
      lnOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('lnOp', 10);
      consoleSpy.mockRestore();
    });
  });
  describe('logOp', () => {
    test('should calculate log base 10 for positive numbers', () => {
      testVM.push(100);
      logOp(testVM);
      expect(testVM.pop()).toBe(2);
    });
    test('should return Infinity for zero', () => {
      testVM.push(0);
      logOp(testVM);
      expect(testVM.pop()).toBe(-Infinity);
    });
    test('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(1000);
      logOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('logOp', 1000);
      consoleSpy.mockRestore();
    });
  });
  describe('sqrtOp', () => {
    test('should calculate square root for positive numbers', () => {
      testVM.push(9);
      sqrtOp(testVM);
      expect(testVM.pop()).toBe(3);
    });
    test('should handle zero', () => {
      testVM.push(0);
      sqrtOp(testVM);
      expect(testVM.pop()).toBe(0);
    });
    test('should return NaN for negative numbers', () => {
      testVM.push(-4);
      sqrtOp(testVM);
      expect(testVM.pop()).toBeNaN();
    });
    test('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(16);
      sqrtOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('sqrtOp', 16);
      consoleSpy.mockRestore();
    });
  });
  describe('powOp', () => {
    test('should calculate a^b for positive numbers', () => {
      testVM.push(2);
      testVM.push(3);
      powOp(testVM);
      expect(testVM.pop()).toBe(8);
    });
    test('should handle negative exponents', () => {
      testVM.push(2);
      testVM.push(-2);
      powOp(testVM);
      expect(testVM.pop()).toBe(0.25);
    });
    test('should handle zero base', () => {
      testVM.push(0);
      testVM.push(5);
      powOp(testVM);
      expect(testVM.pop()).toBe(0);
    });
    test('should handle zero exponent', () => {
      testVM.push(5);
      testVM.push(0);
      powOp(testVM);
      expect(testVM.pop()).toBe(1);
    });
    test('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(4);
      testVM.push(0.5);
      powOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('powOp', 4, 0.5);
      consoleSpy.mockRestore();
    });
  });
  describe('minOp', () => {
    test('should return the smaller of two numbers', () => {
      testVM.push(5);
      testVM.push(10);
      minOp(testVM);
      expect(testVM.pop()).toBe(5);
    });
    test('should handle negative numbers', () => {
      testVM.push(-5);
      testVM.push(10);
      minOp(testVM);
      expect(testVM.pop()).toBe(-5);
    });
    test('should handle equal numbers', () => {
      testVM.push(7);
      testVM.push(7);
      minOp(testVM);
      expect(testVM.pop()).toBe(7);
    });
    test('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(3);
      testVM.push(8);
      minOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('minOp', 3, 8);
      consoleSpy.mockRestore();
    });
  });
  describe('maxOp', () => {
    test('should return the larger of two numbers', () => {
      testVM.push(5);
      testVM.push(10);
      maxOp(testVM);
      expect(testVM.pop()).toBe(10);
    });
    test('should handle negative numbers', () => {
      testVM.push(-5);
      testVM.push(10);
      maxOp(testVM);
      expect(testVM.pop()).toBe(10);
    });
    test('should handle equal numbers', () => {
      testVM.push(7);
      testVM.push(7);
      maxOp(testVM);
      expect(testVM.pop()).toBe(7);
    });
    test('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(3);
      testVM.push(8);
      maxOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('maxOp', 3, 8);
      consoleSpy.mockRestore();
    });
  });
  describe('avgOp', () => {
    test('should calculate the average of two numbers', () => {
      testVM.push(4);
      testVM.push(6);
      avgOp(testVM);
      expect(testVM.pop()).toBe(5);
    });
    test('should handle negative numbers', () => {
      testVM.push(-4);
      testVM.push(6);
      avgOp(testVM);
      expect(testVM.pop()).toBe(1);
    });
    test('should handle fractional results', () => {
      testVM.push(1);
      testVM.push(2);
      avgOp(testVM);
      expect(testVM.pop()).toBe(1.5);
    });
    test('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(3);
      testVM.push(7);
      avgOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('avgOp', 3, 7);
      consoleSpy.mockRestore();
    });
  });
  describe('prodOp', () => {
    test('should calculate the product of two numbers', () => {
      testVM.push(4);
      testVM.push(5);
      prodOp(testVM);
      expect(testVM.pop()).toBe(20);
    });
    test('should handle negative numbers', () => {
      testVM.push(-4);
      testVM.push(5);
      prodOp(testVM);
      expect(testVM.pop()).toBe(-20);
    });
    test('should handle zero', () => {
      testVM.push(0);
      testVM.push(5);
      prodOp(testVM);
      expect(testVM.pop()).toBe(0);
    });
    test('should log when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testVM.debug = true;
      testVM.push(3);
      testVM.push(7);
      prodOp(testVM);
      expect(consoleSpy).toHaveBeenCalledWith('prodOp', 3, 7);
      consoleSpy.mockRestore();
    });
  });
});
