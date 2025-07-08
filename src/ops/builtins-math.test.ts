import { VM } from '../core/vm';
import { initializeInterpreter, vm } from '../core/globalState';

import {
  addOp,
  subtractOp,
  multiplyOp,
  divideOp,
  powerOp,
  modOp,
  minOp,
  maxOp,
  equalOp,
  lessThanOp,
  greaterThanOp,
} from './builtins-math';
describe('Built-in Binary Math Operations', () => {
  let testVM: VM;

  beforeEach(() => {
    initializeInterpreter();
    testVM = vm;
    testVM.debug = false;
  });
  describe('addOp (add)', () => {
    test('should add two numbers correctly', () => {
      testVM.push(5);
      testVM.push(3);
      addOp(testVM);
      expect(testVM.pop()).toBe(8);
    });
    test('should handle negative numbers', () => {
      testVM.push(-5);
      testVM.push(10);
      addOp(testVM);
      expect(testVM.pop()).toBe(5);
    });
    test('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => addOp(testVM)).toThrow('Stack underflow');
    });
  });
  describe('subtractOp (sub)', () => {
    test('should subtract two numbers correctly', () => {
      testVM.push(10);
      testVM.push(4);
      subtractOp(testVM);
      expect(testVM.pop()).toBe(6);
    });
    test('should handle negative results', () => {
      testVM.push(5);
      testVM.push(10);
      subtractOp(testVM);
      expect(testVM.pop()).toBe(-5);
    });
    test('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => subtractOp(testVM)).toThrow('Stack underflow');
    });
  });
  describe('multiplyOp (multiply)', () => {
    test('should multiply two numbers correctly', () => {
      testVM.push(5);
      testVM.push(3);
      multiplyOp(testVM);
      expect(testVM.pop()).toBe(15);
    });
    test('should handle negative numbers', () => {
      testVM.push(-5);
      testVM.push(3);
      multiplyOp(testVM);
      expect(testVM.pop()).toBe(-15);
    });
    test('should handle zero', () => {
      testVM.push(5);
      testVM.push(0);
      multiplyOp(testVM);
      expect(testVM.pop()).toBe(0);
    });
    test('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => multiplyOp(testVM)).toThrow('Stack underflow');
    });
  });
  describe('divideOp (divide)', () => {
    test('should divide two numbers correctly', () => {
      testVM.push(10);
      testVM.push(2);
      divideOp(testVM);
      expect(testVM.pop()).toBe(5);
    });
    test('should handle decimal results', () => {
      testVM.push(10);
      testVM.push(3);
      divideOp(testVM);
      expect(testVM.pop()).toBeCloseTo(3.33333, 4);
    });
    test('should handle negative numbers', () => {
      testVM.push(-10);
      testVM.push(2);
      divideOp(testVM);
      expect(testVM.pop()).toBe(-5);
    });
    test('should handle division by zero', () => {
      testVM.push(5);
      testVM.push(0);
      divideOp(testVM);
      expect(testVM.pop()).toBe(Infinity);
    });
    test('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => divideOp(testVM)).toThrow('Stack underflow');
    });
  });
  describe('powerOp (power)', () => {
    test('should calculate power correctly', () => {
      testVM.push(2);
      testVM.push(3);
      powerOp(testVM);
      expect(testVM.pop()).toBe(8);
    });
    test('should handle fractional exponents', () => {
      testVM.push(4);
      testVM.push(0.5);
      powerOp(testVM);
      expect(testVM.pop()).toBe(2);
    });
    test('should handle negative base', () => {
      testVM.push(-2);
      testVM.push(2);
      powerOp(testVM);
      expect(testVM.pop()).toBe(4);
    });
    test('should handle zero base', () => {
      testVM.push(0);
      testVM.push(5);
      powerOp(testVM);
      expect(testVM.pop()).toBe(0);
    });
    test('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => powerOp(testVM)).toThrow('Stack underflow');
    });
  });
  describe('modOp (mod)', () => {
    test('should calculate modulo correctly', () => {
      testVM.push(10);
      testVM.push(3);
      modOp(testVM);
      expect(testVM.pop()).toBe(1);
    });
    test('should handle negative numbers', () => {
      testVM.push(-10);
      testVM.push(3);
      modOp(testVM);
      expect(testVM.pop()).toBe(-1);
    });
    test('should handle zero modulus', () => {
      testVM.push(5);
      testVM.push(0);
      modOp(testVM);
      expect(testVM.pop()).toBeNaN();
    });
    test('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => modOp(testVM)).toThrow('Stack underflow');
    });
  });
  describe('minOp (min)', () => {
    test('should return the smaller value', () => {
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
    test('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => minOp(testVM)).toThrow('Stack underflow');
    });
  });
  describe('maxOp (max)', () => {
    test('should return the larger value', () => {
      testVM.push(5);
      testVM.push(10);
      maxOp(testVM);
      expect(testVM.pop()).toBe(10);
    });
    test('should handle negative numbers', () => {
      testVM.push(-5);
      testVM.push(-10);
      maxOp(testVM);
      expect(testVM.pop()).toBe(-5);
    });
    test('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => maxOp(testVM)).toThrow('Stack underflow');
    });
  });
  describe('equalOp (equal)', () => {
    test('should return 1 for equal values', () => {
      testVM.push(5);
      testVM.push(5);
      equalOp(testVM);
      expect(testVM.pop()).toBe(1);
    });
    test('should return 0 for unequal values', () => {
      testVM.push(5);
      testVM.push(10);
      equalOp(testVM);
      expect(testVM.pop()).toBe(0);
    });
    test('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => equalOp(testVM)).toThrow('Stack underflow');
    });
  });
  describe('lessThanOp (lessThan)', () => {
    test('should return 1 when a < b', () => {
      testVM.push(5);
      testVM.push(10);
      lessThanOp(testVM);
      expect(testVM.pop()).toBe(1);
    });
    test('should return 0 when a >= b', () => {
      testVM.push(10);
      testVM.push(5);
      lessThanOp(testVM);
      expect(testVM.pop()).toBe(0);
    });
    test('should handle equal values', () => {
      testVM.push(5);
      testVM.push(5);
      lessThanOp(testVM);
      expect(testVM.pop()).toBe(0);
    });
    test('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => lessThanOp(testVM)).toThrow('Stack underflow');
    });
  });
  describe('greaterThanOp (greaterThan)', () => {
    test('should return 1 when a > b', () => {
      testVM.push(10);
      testVM.push(5);
      greaterThanOp(testVM);
      expect(testVM.pop()).toBe(1);
    });
    test('should return 0 when a <= b', () => {
      testVM.push(5);
      testVM.push(10);
      greaterThanOp(testVM);
      expect(testVM.pop()).toBe(0);
    });
    test('should handle equal values', () => {
      testVM.push(5);
      testVM.push(5);
      greaterThanOp(testVM);
      expect(testVM.pop()).toBe(0);
    });
    test('should throw on stack underflow', () => {
      testVM.push(5);
      expect(() => greaterThanOp(testVM)).toThrow('Stack underflow');
    });
  });
});
