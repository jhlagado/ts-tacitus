/**
 * Clean test for exitOp behavior with proper function calls
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../core';
import { executeTacitCode } from '../utils/vm-test-utils';

describe('Function Exit Behavior', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('should properly restore BP after function call', () => {
    // Record initial state
    const initialBP = vm.bp;
    const initialRSP = vm.rsp;

    // Execute a simple function call
    const result = executeTacitCode(
      vm,
      `
      : simple-func 42 ;
      simple-func
    `,
    );

    // Function should return correct value
    expect(result).toEqual([42]);

    // BP and RP should be restored to initial values
    expect(vm.bp).toBe(initialBP);
    expect(vm.rsp).toBe(initialRSP);
  });

  test('should properly restore BP after function with local variables', () => {
    const initialBP = vm.bp;
    const initialRSP = vm.rsp;

    const result = executeTacitCode(
      vm,
      `
      : func-with-vars 42 var x x ;
      func-with-vars
    `,
    );

    expect(result).toEqual([42]);

    // BP should be restored even with local variables
    expect(vm.bp).toBe(initialBP);
    expect(vm.rsp).toBe(initialRSP);
  });

  test('should handle nested function calls correctly', () => {
    const initialBP = vm.bp;
    const initialRSP = vm.rsp;

    const result = executeTacitCode(
      vm,
      `
      : inner 1 add ;
      : outer 10 inner ;
      5 outer
    `,
    );

    expect(result).toEqual([5, 11]); // 5 + 10 + 1
    expect(vm.bp).toBe(initialBP);
    expect(vm.rsp).toBe(initialRSP);
  });
});
