/*
Tests for comparison operations - TACIT's relational operators
All operations work on stack values and return 1 (true) or 0 (false)
*/
import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from '../../core/vm';
import { initializeInterpreter, vm } from '../../core/globalState';
import {
  equalOp,
  lessThanOp,
  greaterThanOp,
  lessOrEqualOp,
  greaterOrEqualOp,
} from '../../ops/builtins-math';

describe('Comparison Operations', () => {
  let testVM: VM;

  beforeEach(() => {
    initializeInterpreter();
    testVM = vm;
    testVM.debug = false;
  });

  test('equal - should return 1 for equal values', () => {
    testVM.push(5);
    testVM.push(5);
    equalOp(testVM);
    expect(testVM.pop()).toBe(1);
  });

  test('equal - should return 0 for unequal values', () => {
    testVM.push(5);
    testVM.push(6);
    equalOp(testVM);
    expect(testVM.pop()).toBe(0);
  });

  test('equal - should handle negative numbers', () => {
    testVM.push(-3);
    testVM.push(-3);
    equalOp(testVM);
    expect(testVM.pop()).toBe(1);
  });

  test('equal - should handle zero', () => {
    testVM.push(0);
    testVM.push(0);
    equalOp(testVM);
    expect(testVM.pop()).toBe(1);
  });

  test('equal - should throw on stack underflow', () => {
    testVM.push(5);
    expect(() => equalOp(testVM)).toThrow('Stack underflow');
  });

  test('less than - should return 1 when a < b', () => {
    testVM.push(5);
    testVM.push(10);
    lessThanOp(testVM);
    expect(testVM.pop()).toBe(1);
  });

  test('less than - should return 0 when a >= b', () => {
    testVM.push(10);
    testVM.push(5);
    lessThanOp(testVM);
    expect(testVM.pop()).toBe(0);
  });

  test('less than - should handle equal values', () => {
    testVM.push(5);
    testVM.push(5);
    lessThanOp(testVM);
    expect(testVM.pop()).toBe(0);
  });

  test('less than - should handle negative numbers', () => {
    testVM.push(-10);
    testVM.push(-5);
    lessThanOp(testVM);
    expect(testVM.pop()).toBe(1);
  });

  test('less than - should throw on stack underflow', () => {
    testVM.push(5);
    expect(() => lessThanOp(testVM)).toThrow('Stack underflow');
  });

  test('greater than - should return 1 when a > b', () => {
    testVM.push(10);
    testVM.push(5);
    greaterThanOp(testVM);
    expect(testVM.pop()).toBe(1);
  });

  test('greater than - should return 0 when a <= b', () => {
    testVM.push(5);
    testVM.push(10);
    greaterThanOp(testVM);
    expect(testVM.pop()).toBe(0);
  });

  test('greater than - should handle equal values', () => {
    testVM.push(5);
    testVM.push(5);
    greaterThanOp(testVM);
    expect(testVM.pop()).toBe(0);
  });

  test('greater than - should handle negative numbers', () => {
    testVM.push(-5);
    testVM.push(-10);
    greaterThanOp(testVM);
    expect(testVM.pop()).toBe(1);
  });

  test('greater than - should throw on stack underflow', () => {
    testVM.push(5);
    expect(() => greaterThanOp(testVM)).toThrow('Stack underflow');
  });

  test('less than or equal - should return 1 when a <= b', () => {
    testVM.push(5);
    testVM.push(10);
    lessOrEqualOp(testVM);
    expect(testVM.pop()).toBe(1);
  });

  test('less than or equal - should return 1 when a == b', () => {
    testVM.push(5);
    testVM.push(5);
    lessOrEqualOp(testVM);
    expect(testVM.pop()).toBe(1);
  });

  test('less than or equal - should return 0 when a > b', () => {
    testVM.push(10);
    testVM.push(5);
    lessOrEqualOp(testVM);
    expect(testVM.pop()).toBe(0);
  });

  test('less than or equal - should throw on stack underflow', () => {
    testVM.push(5);
    expect(() => lessOrEqualOp(testVM)).toThrow('Stack underflow');
  });

  test('greater than or equal - should return 1 when a >= b', () => {
    testVM.push(10);
    testVM.push(5);
    greaterOrEqualOp(testVM);
    expect(testVM.pop()).toBe(1);
  });

  test('greater than or equal - should return 1 when a == b', () => {
    testVM.push(5);
    testVM.push(5);
    greaterOrEqualOp(testVM);
    expect(testVM.pop()).toBe(1);
  });

  test('greater than or equal - should return 0 when a < b', () => {
    testVM.push(5);
    testVM.push(10);
    greaterOrEqualOp(testVM);
    expect(testVM.pop()).toBe(0);
  });

  test('greater than or equal - should throw on stack underflow', () => {
    testVM.push(5);
    expect(() => greaterOrEqualOp(testVM)).toThrow('Stack underflow');
  });
});
