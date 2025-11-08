/*
Tests for conditional operations - Tacit's control flow operations
IF/ELSE statements that execute code blocks based on stack conditions
*/
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM } from '../../../core/vm';
import { executeProgram } from '../../../lang/interpreter';
import { getStackData } from '../../../core/vm';

describe('Conditional Operations', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
    vm.debug = false;
  });

  describe('simple values', () => {
    test('if executes then-branch when condition is true', () => {
      executeProgram(vm, '1 if 2 3 add ;');
      expect(getStackData(vm)).toEqual([5]);
    });

    test('if skips then-branch when condition is false', () => {
      executeProgram(vm, '0 if 2 3 add ;');
      expect(getStackData(vm)).toEqual([]);
    });

    test('if handles empty then-branch', () => {
      executeProgram(vm, '1 if ;');
      expect(getStackData(vm)).toEqual([]);
    });

    test('if/else executes then-branch when condition is true', () => {
      executeProgram(vm, '1 if 10 else 20 ;');
      expect(getStackData(vm)).toEqual([10]);
    });

    test('if/else executes else-branch when condition is false', () => {
      executeProgram(vm, '0 if 10 else 20 ;');
      expect(getStackData(vm)).toEqual([20]);
    });

    test('if/else handles empty else-branch', () => {
      executeProgram(vm, '0 if 10 else ;');
      expect(getStackData(vm)).toEqual([]);
    });

    test('if/else works with comparison operators', () => {
      executeProgram(vm, '5 10 lt if 100 else 200 ;');
      expect(getStackData(vm)).toEqual([100]);
    });
  });

  describe('list operations', () => {});

  describe('error cases', () => {});

  describe('integration tests', () => {
    test('if handles nested conditionals', () => {
      executeProgram(vm, '1 if 2 0 if 3 ; ;');
      expect(getStackData(vm)).toEqual([2]);
    });

    test('if/else handles complex expressions', () => {
      executeProgram(vm, '5 3 gt if 2 3 mul else 2 3 add ;');
      expect(getStackData(vm)).toEqual([6]);
    });

    test('if/else handles multiple statements in branches', () => {
      executeProgram(vm, `
        1 if
          2 3 mul
          4 5 mul
          add
        else
          6 7 mul
        ;
      `);
      expect(getStackData(vm)).toEqual([26]);
    });

    test('if/else works with multiple conditions', () => {
      executeProgram(vm, '3 3 eq if 7 7 eq if 42 else 24 ; else 0 ;');
      expect(getStackData(vm)).toEqual([42]);
    });
  });
});
