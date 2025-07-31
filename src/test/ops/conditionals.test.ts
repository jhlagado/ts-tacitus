/*
Tests for conditional operations - TACIT's control flow operations
IF/ELSE statements that execute code blocks based on stack conditions
*/
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../core/globalState';
import { executeProgram } from '../../lang/interpreter';

describe('Conditional Operations', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('simple values', () => {
    test('IF - should execute then-branch when condition is true', () => {
      executeProgram('1 IF { 2 3 add }');
      expect(vm.getStackData()).toEqual([5]);
    });

    test('IF - should not execute then-branch when condition is false', () => {
      executeProgram('0 IF { 2 3 add }');
      expect(vm.getStackData()).toEqual([]);
    });

    test('IF - should handle empty then-branch', () => {
      executeProgram('1 IF { }');
      expect(vm.getStackData()).toEqual([]);
    });

    test('IF ELSE - should execute then-branch when condition is true', () => {
      executeProgram('1 IF { 10 } ELSE { 20 }');
      expect(vm.getStackData()).toEqual([10]);
    });

    test('IF ELSE - should execute else-branch when condition is false', () => {
      executeProgram('0 IF { 10 } ELSE { 20 }');
      expect(vm.getStackData()).toEqual([20]);
    });

    test('IF ELSE - should handle empty else-branch', () => {
      executeProgram('0 IF { 10 } ELSE { }');
      expect(vm.getStackData()).toEqual([]);
    });

    test('IF ELSE - should work with comparison operators', () => {
      executeProgram('5 10 lt IF { 100 } ELSE { 200 }');
      expect(vm.getStackData()).toEqual([100]);
    });
  });

  describe('list operations', () => {
    // TODO: Add list-specific conditional tests when list operations are implemented
  });

  describe('error cases', () => {
    // TODO: Add error handling tests for stack underflow and invalid conditions
  });

  describe('integration tests', () => {
    test('IF - should handle nested IF statements', () => {
      executeProgram('1 IF { 2 0 IF { 3 } }');
      expect(vm.getStackData()).toEqual([2]);
    });

    test('IF ELSE - should handle complex expressions in branches', () => {
      executeProgram('5 3 gt IF { 2 3 mul } ELSE { 2 3 add }');
      expect(vm.getStackData()).toEqual([6]);
    });

    test('IF ELSE - should handle multiple statements in branches', () => {
      executeProgram(`
        1 IF {
          2 3 mul
          4 5 mul
          add
        } ELSE {
          6 7 mul
        }
      `);
      expect(vm.getStackData()).toEqual([26]);
    });

    test('IF ELSE - should work with multiple conditions', () => {
      executeProgram('3 3 eq IF { 7 7 eq IF { 42 } ELSE { 24 } } ELSE { 0 }');
      expect(vm.getStackData()).toEqual([42]);
    });
  });
});
