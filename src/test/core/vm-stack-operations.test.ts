import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  STACK_SIZE,
  RSTACK_SIZE,
  StackOverflowError,
  ReturnStackOverflowError,
  StackUnderflowError,
} from '../../core';
import { initializeInterpreter, vm } from '../../core/global-state';

const CELL_SIZE = 4;

describe('VM Stack Operations Error Handling', () => {
  // Changed describe block name
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  test('should throw StackOverflowError when data stack overflows', () => {
    const maxElements = STACK_SIZE / CELL_SIZE;
    for (let i = 0; i < maxElements; i++) {
      vm.push(i);
    }

    expect(() => vm.push(999)).toThrow(StackOverflowError);
    expect(() => vm.push(999)).toThrow(/Stack overflow: 'push' would exceed stack size/);
  });

  test('should throw ReturnStackOverflowError when return stack overflows', () => {
    const maxElements = RSTACK_SIZE / CELL_SIZE;
    for (let i = 0; i < maxElements; i++) {
      vm.rpush(i);
    }

    expect(() => vm.rpush(999)).toThrow(ReturnStackOverflowError);
    expect(() => vm.rpush(999)).toThrow(
      /Return stack \(RSP\) overflow: 'rpush' would exceed return stack size/,
    );
  });

  test('StackOverflowError should contain correct stack state', () => {
    const maxElements = STACK_SIZE / CELL_SIZE;
    for (let i = 0; i < maxElements; i++) {
      vm.push(i);
    }
    const expectedStackData = vm.getStackData();

    try {
      vm.push(999);
    } catch (error) {
      expect(error).toBeInstanceOf(StackOverflowError);
      expect((error as StackOverflowError).stackState).toEqual(expectedStackData);
    }
  });

  test('ReturnStackOverflowError should contain correct stack state', () => {
    const maxElements = RSTACK_SIZE / CELL_SIZE;
    for (let i = 0; i < maxElements; i++) {
      vm.rpush(i);
    }
    const expectedStackData = vm.getStackData(); // Note: getStackData() returns data stack, not return stack

    try {
      vm.rpush(999);
    } catch (error) {
      expect(error).toBeInstanceOf(ReturnStackOverflowError);
      // The stackState in ReturnStackOverflowError currently refers to the data stack,
      // which is consistent with the current error class implementation.
      expect((error as ReturnStackOverflowError).stackState).toEqual(expectedStackData);
    }
  });

  // New tests for underflow conditions
  test('should throw StackUnderflowError when pop is called on empty stack', () => {
    expect(() => vm.pop()).toThrow(StackUnderflowError);
    expect(() => vm.pop()).toThrow(/Stack underflow: 'pop' requires 1 operand/);
  });

  test('should throw StackUnderflowError when peek is called on empty stack', () => {
    expect(() => vm.peek()).toThrow(StackUnderflowError);
    expect(() => vm.peek()).toThrow(/Stack underflow: 'peek' requires 1 operand/);
  });

  test('should throw StackUnderflowError when popArray is called with insufficient elements', () => {
    vm.push(1); // Push one element
    expect(() => vm.popArray(2)).toThrow(StackUnderflowError);
    expect(() => vm.popArray(2)).toThrow(/Stack underflow: 'popArray' requires 2 operands/);
  });

  test('should throw StackUnderflowError when popArray is called on empty stack', () => {
    expect(() => vm.popArray(1)).toThrow(StackUnderflowError);
    expect(() => vm.popArray(1)).toThrow(/Stack underflow: 'popArray' requires 1 operand/);
  });
});
