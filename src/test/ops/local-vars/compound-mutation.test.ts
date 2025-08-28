/**
 * @file src/test/ops/local-vars/compound-mutation.test.ts
 * Tests for in-place compound variable mutation.
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../../core/globalState';
import { executeTacitCode, resetVM } from '../../utils/vm-test-utils';

describe('Compound Variable Mutation', () => {
  beforeEach(() => {
    resetVM();
    vm.debug = false;
  });

  test('should perform compatible compound assignment', () => {
    const code = `
      : main
        ( 1 2 3 ) var x
        ( 4 5 6 ) -> x
        x unref
      ;
      main
    `;
    const result = executeTacitCode(code);

    // Expected: the new list (4 5 6) should be on the stack
    // Stack layout for (4 5 6) is [6, 5, 4, LIST:3]
    expect(result).toEqual([6, 5, 4, expect.any(Number)]);
  });

  test('should throw error for incompatible compound assignment', () => {
    const code = `
      : main
        ( 1 2 3 ) var x
        ( 4 5 ) -> x
      ;
      main
    `;
    expect(() => executeTacitCode(code)).toThrow('Incompatible compound assignment: slot count or type mismatch');
  });

  test('should throw error for assigning simple to compound', () => {
    const code = `
      : main
        ( 1 2 3 ) var x
        42 -> x
      ;
      main
    `;
    expect(() => executeTacitCode(code)).toThrow('Cannot assign simple to compound or compound to simple');
  });

  test('should throw error for assigning compound to simple', () => {
    const code = `
      : main
        42 var x
        ( 1 2 3 ) -> x
      ;
      main
    `;
    expect(() => executeTacitCode(code)).toThrow('Cannot assign simple to compound or compound to simple');
  });
});
