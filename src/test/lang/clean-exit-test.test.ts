/**
 * Clean test for exitOp behavior with proper function calls
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../core/global-state';
import { executeTacitCode } from '../utils/vm-test-utils';

describe('Function Exit Behavior', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  test('should properly restore BP after function call', () => {
    // Record initial state
  const initialBP = vm.BP;
  const initialRSP = vm.RSP;

    // Execute a simple function call
    const result = executeTacitCode(`
      : simple-func 42 ;
      simple-func
    `);

    // Function should return correct value
    expect(result).toEqual([42]);

    // BP and RP should be restored to initial values
    expect(vm.BP).toBe(initialBP);
  expect(vm.RSP).toBe(initialRSP);
  });

  test('should properly restore BP after function with local variables', () => {
  const initialBP = vm.BP;
  const initialRSP = vm.RSP;

    const result = executeTacitCode(`
      : func-with-vars 42 var x x ;
      func-with-vars
    `);

    expect(result).toEqual([42]);

    // BP should be restored even with local variables
    expect(vm.BP).toBe(initialBP);
  expect(vm.RSP).toBe(initialRSP);
  });

  test('should handle nested function calls correctly', () => {
  const initialBP = vm.BP;
  const initialRSP = vm.RSP;

    const result = executeTacitCode(`
      : inner 1 add ;
      : outer 10 inner ;
      5 outer
    `);

    expect(result).toEqual([5, 11]); // 5 + 10 + 1
    expect(vm.BP).toBe(initialBP);
  expect(vm.RSP).toBe(initialRSP);
  });
});
