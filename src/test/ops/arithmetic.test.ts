/*
Tests for arithmetic operations - TACIT's mathematical operations
All operations work on stack values and are list-aware
*/
import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from '../../core/vm';
import { initializeInterpreter, vm } from '../../core/globalState';
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
  lessOrEqualOp,
  greaterOrEqualOp,
} from '../../ops/builtins-math';
import {
  absOp,
  negOp,
  signOp,
  expOp,
  lnOp,
  logOp,
  sqrtOp,
  powOp as arithmeticPowOp,
  avgOp,
  prodOp,
} from '../../ops/arithmetic-ops';

describe('Arithmetic Operations', () => {
  let testVM: VM;

  beforeEach(() => {
    initializeInterpreter();
    testVM = vm;
    testVM.debug = false;
  });

  test('add - should add two numbers correctly', () => {
    testVM.push(5);
    testVM.push(3);
    addOp(testVM);
    expect(testVM.pop()).toBe(8);
  });

  test('add - should handle negative numbers', () => {
    testVM.push(-5);
    testVM.push(10);
    addOp(testVM);
    expect(testVM.pop()).toBe(5);
  });

  test('add - should handle zero values', () => {
    testVM.push(0);
    testVM.push(0);
    addOp(testVM);
    expect(testVM.pop()).toBe(0);
  });

  test('add - should throw on stack underflow', () => {
    testVM.push(5);
    expect(() => addOp(testVM)).toThrow('Stack underflow');
  });

  test('subtract - should subtract two numbers correctly', () => {
    testVM.push(10);
    testVM.push(4);
    subtractOp(testVM);
    expect(testVM.pop()).toBe(6);
  });

  test('subtract - should handle negative results', () => {
    testVM.push(5);
    testVM.push(10);
    subtractOp(testVM);
    expect(testVM.pop()).toBe(-5);
  });

  test('subtract - should handle negative operands', () => {
    testVM.push(-3);
    testVM.push(-8);
    subtractOp(testVM);
    expect(testVM.pop()).toBe(5);
  });

  test('subtract - should throw on stack underflow', () => {
    testVM.push(5);
    expect(() => subtractOp(testVM)).toThrow('Stack underflow');
  });

  test('multiply - should multiply two numbers correctly', () => {
    testVM.push(5);
    testVM.push(3);
    multiplyOp(testVM);
    expect(testVM.pop()).toBe(15);
  });

  test('multiply - should handle negative numbers', () => {
    testVM.push(-5);
    testVM.push(3);
    multiplyOp(testVM);
    expect(testVM.pop()).toBe(-15);
  });

  test('multiply - should handle zero', () => {
    testVM.push(5);
    testVM.push(0);
    multiplyOp(testVM);
    expect(testVM.pop()).toBe(0);
  });

  test('multiply - should throw on stack underflow', () => {
    testVM.push(5);
    expect(() => multiplyOp(testVM)).toThrow('Stack underflow');
  });

  test('divide - should divide two numbers correctly', () => {
    testVM.push(10);
    testVM.push(2);
    divideOp(testVM);
    expect(testVM.pop()).toBe(5);
  });

  test('divide - should handle decimal results', () => {
    testVM.push(10);
    testVM.push(3);
    divideOp(testVM);
    expect(testVM.pop()).toBeCloseTo(3.33333, 4);
  });

  test('divide - should handle negative numbers', () => {
    testVM.push(-10);
    testVM.push(2);
    divideOp(testVM);
    expect(testVM.pop()).toBe(-5);
  });

  test('divide - should handle division by zero', () => {
    testVM.push(5);
    testVM.push(0);
    divideOp(testVM);
    expect(testVM.pop()).toBe(Infinity);
  });

  test('divide - should throw on stack underflow', () => {
    testVM.push(5);
    expect(() => divideOp(testVM)).toThrow('Stack underflow');
  });

  test('power - should calculate power correctly', () => {
    testVM.push(2);
    testVM.push(3);
    powerOp(testVM);
    expect(testVM.pop()).toBe(8);
  });

  test('power - should handle fractional exponents', () => {
    testVM.push(4);
    testVM.push(0.5);
    powerOp(testVM);
    expect(testVM.pop()).toBe(2);
  });

  test('power - should handle negative base', () => {
    testVM.push(-2);
    testVM.push(2);
    powerOp(testVM);
    expect(testVM.pop()).toBe(4);
  });

  test('power - should handle zero base', () => {
    testVM.push(0);
    testVM.push(5);
    powerOp(testVM);
    expect(testVM.pop()).toBe(0);
  });

  test('power - should throw on stack underflow', () => {
    testVM.push(5);
    expect(() => powerOp(testVM)).toThrow('Stack underflow');
  });

  test('modulo - should calculate modulo correctly', () => {
    testVM.push(10);
    testVM.push(3);
    modOp(testVM);
    expect(testVM.pop()).toBe(1);
  });

  test('modulo - should handle negative numbers', () => {
    testVM.push(-10);
    testVM.push(3);
    modOp(testVM);
    expect(testVM.pop()).toBe(-1);
  });

  test('modulo - should handle zero modulus', () => {
    testVM.push(5);
    testVM.push(0);
    modOp(testVM);
    expect(testVM.pop()).toBe(NaN);
  });

  test('modulo - should throw on stack underflow', () => {
    testVM.push(5);
    expect(() => modOp(testVM)).toThrow('Stack underflow');
  });

  test('min - should return the smaller value', () => {
    testVM.push(10);
    testVM.push(5);
    minOp(testVM);
    expect(testVM.pop()).toBe(5);
  });

  test('min - should handle negative numbers', () => {
    testVM.push(-5);
    testVM.push(-10);
    minOp(testVM);
    expect(testVM.pop()).toBe(-10);
  });

  test('min - should throw on stack underflow', () => {
    testVM.push(5);
    expect(() => minOp(testVM)).toThrow('Stack underflow');
  });

  test('max - should return the larger value', () => {
    testVM.push(10);
    testVM.push(5);
    maxOp(testVM);
    expect(testVM.pop()).toBe(10);
  });

  test('max - should handle negative numbers', () => {
    testVM.push(-5);
    testVM.push(-10);
    maxOp(testVM);
    expect(testVM.pop()).toBe(-5);
  });

  test('max - should throw on stack underflow', () => {
    testVM.push(5);
    expect(() => maxOp(testVM)).toThrow('Stack underflow');
  });

  test('absolute - should return absolute value of negative number', () => {
    testVM.push(-5);
    absOp(testVM);
    expect(testVM.pop()).toBe(5);
  });

  test('absolute - should return same value for positive numbers', () => {
    testVM.push(10);
    absOp(testVM);
    expect(testVM.pop()).toBe(10);
  });

  test('absolute - should handle zero', () => {
    testVM.push(0);
    absOp(testVM);
    expect(testVM.pop()).toBe(0);
  });

  test('negate - should negate a positive number', () => {
    testVM.push(5);
    negOp(testVM);
    expect(testVM.pop()).toBe(-5);
  });

  test('negate - should negate a negative number', () => {
    testVM.push(-3);
    negOp(testVM);
    expect(testVM.pop()).toBe(3);
  });

  test('negate - should handle zero', () => {
    testVM.push(0);
    negOp(testVM);
    expect(testVM.pop()).toBe(-0);
  });

  test('sign - should return 1 for positive numbers', () => {
    testVM.push(5);
    signOp(testVM);
    expect(testVM.pop()).toBe(1);
  });

  test('sign - should return -1 for negative numbers', () => {
    testVM.push(-3);
    signOp(testVM);
    expect(testVM.pop()).toBe(-1);
  });

  test('sign - should return 0 for zero', () => {
    testVM.push(0);
    signOp(testVM);
    expect(testVM.pop()).toBe(0);
  });

  test('square root - should calculate square root correctly', () => {
    testVM.push(16);
    sqrtOp(testVM);
    expect(testVM.pop()).toBe(4);
  });

  test('square root - should handle zero', () => {
    testVM.push(0);
    sqrtOp(testVM);
    expect(testVM.pop()).toBe(0);
  });

  test('exponential - should calculate e^x correctly', () => {
    testVM.push(1);
    expOp(testVM);
    expect(testVM.pop()).toBeCloseTo(Math.E, 5);
  });

  test('natural log - should calculate ln correctly', () => {
    testVM.push(Math.E);
    lnOp(testVM);
    expect(testVM.pop()).toBeCloseTo(1, 5);
  });

  test('log base 10 - should calculate log10 correctly', () => {
    testVM.push(100);
    logOp(testVM);
    expect(testVM.pop()).toBeCloseTo(2, 5);
  });
});
