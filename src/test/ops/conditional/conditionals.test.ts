/*
Tests for conditional operations - Tacit's control flow operations
IF/ELSE statements that execute code blocks based on stack conditions
*/
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../../core/global-state';
import { executeProgram } from '../../../lang/interpreter';

describe('Conditional Operations', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('simple values', () => {
    test('if executes then-branch when condition is true', () => {
      executeProgram('1 if 2 3 add ;');
      expect(vm.getStackData()).toEqual([5]);
    });

    test('if skips then-branch when condition is false', () => {
      executeProgram('0 if 2 3 add ;');
      expect(vm.getStackData()).toEqual([]);
    });

    test('if handles empty then-branch', () => {
      executeProgram('1 if ;');
      expect(vm.getStackData()).toEqual([]);
    });

    test('if/else executes then-branch when condition is true', () => {
      executeProgram('1 if 10 else 20 ;');
      expect(vm.getStackData()).toEqual([10]);
    });

    test('if/else executes else-branch when condition is false', () => {
      executeProgram('0 if 10 else 20 ;');
      expect(vm.getStackData()).toEqual([20]);
    });

    test('if/else handles empty else-branch', () => {
      executeProgram('0 if 10 else ;');
      expect(vm.getStackData()).toEqual([]);
    });

    test('if/else works with comparison operators', () => {
      executeProgram('5 10 lt if 100 else 200 ;');
      expect(vm.getStackData()).toEqual([100]);
    });
  });

  describe('list operations', () => {});

  describe('error cases', () => {});

  describe('integration tests', () => {
    test('if handles nested conditionals', () => {
      executeProgram('1 if 2 0 if 3 ; ;');
      expect(vm.getStackData()).toEqual([2]);
    });

    test('if/else handles complex expressions', () => {
      executeProgram('5 3 gt if 2 3 mul else 2 3 add ;');
      expect(vm.getStackData()).toEqual([6]);
    });

    test('if/else handles multiple statements in branches', () => {
      executeProgram(`
        1 if
          2 3 mul
          4 5 mul
          add
        else
          6 7 mul
        ;
      `);
      expect(vm.getStackData()).toEqual([26]);
    });

    test('if/else works with multiple conditions', () => {
      executeProgram('3 3 eq if 7 7 eq if 42 else 24 ; else 0 ;');
      expect(vm.getStackData()).toEqual([42]);
    });
  });
});
