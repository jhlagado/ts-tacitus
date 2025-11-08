import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  STACK_SIZE,
  RSTACK_SIZE,
  StackOverflowError,
  ReturnStackOverflowError,
  StackUnderflowError,
} from '../../core';
import { initializeInterpreter, vm } from '../utils/vm-test-utils';
import { popArray, push, rpush, getStackData, peek, pop } from '../../core/vm';

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
      push(vm, i);
    }

    expect(() => push(vm, 999)).toThrow(StackOverflowError);
    expect(() => push(vm, 999)).toThrow(/Stack overflow: 'push' would exceed stack size/);
  });

  test('should throw ReturnStackOverflowError when return stack overflows', () => {
    const maxElements = RSTACK_SIZE / CELL_SIZE;
    for (let i = 0; i < maxElements; i++) {
      rpush(vm, i);
    }

    expect(() => rpush(vm, 999)).toThrow(ReturnStackOverflowError);
    expect(() => rpush(vm, 999)).toThrow(
      /Return stack \(RSP\) overflow: 'rpush' would exceed return stack size/,
    );
  });

  test('StackOverflowError should contain correct stack state', () => {
    const maxElements = STACK_SIZE / CELL_SIZE;
    for (let i = 0; i < maxElements; i++) {
      push(vm, i);
    }
    const expectedStackData = getStackData(vm);

    try {
      push(vm, 999);
    } catch (error) {
      expect(error).toBeInstanceOf(StackOverflowError);
      expect((error as StackOverflowError).stackState).toEqual(expectedStackData);
    }
  });

  test('ReturnStackOverflowError should contain correct stack state', () => {
    const maxElements = RSTACK_SIZE / CELL_SIZE;
    for (let i = 0; i < maxElements; i++) {
      rpush(vm, i);
    }
    const expectedStackData = getStackData(vm); // Note: getStackData() returns data stack, not return stack

    try {
      rpush(vm, 999);
    } catch (error) {
      expect(error).toBeInstanceOf(ReturnStackOverflowError);
      // The stackState in ReturnStackOverflowError currently refers to the data stack,
      // which is consistent with the current error class implementation.
      expect((error as ReturnStackOverflowError).stackState).toEqual(expectedStackData);
    }
  });

  // New tests for underflow conditions
  test('should throw StackUnderflowError when pop is called on empty stack', () => {
    expect(() => pop(vm)).toThrow(StackUnderflowError);
    expect(() => pop(vm)).toThrow(/Stack underflow: 'pop' requires 1 operand/);
  });

  test('should throw StackUnderflowError when peek is called on empty stack', () => {
    expect(() => peek(vm)).toThrow(StackUnderflowError);
    expect(() => peek(vm)).toThrow(/Stack underflow: 'peek' requires 1 operand/);
  });

  test('should throw StackUnderflowError when popArray is called with insufficient elements', () => {
    push(vm, 1); // Push one element
    expect(() => popArray(vm, 2)).toThrow(StackUnderflowError);
    expect(() => popArray(vm, 2)).toThrow(/Stack underflow: 'popArray' requires 2 operands/);
  });

  test('should throw StackUnderflowError when popArray is called on empty stack', () => {
    expect(() => popArray(vm, 1)).toThrow(StackUnderflowError);
    expect(() => popArray(vm, 1)).toThrow(/Stack underflow: 'popArray' requires 1 operand/);
  });
});
