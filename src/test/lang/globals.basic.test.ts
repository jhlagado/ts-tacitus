import { describe, test, expect } from '@jest/globals';
import { executeTacitCode } from '../utils/vm-test-utils';

describe('Global variables (SEG_GLOBAL + GLOBAL_REF)', () => {
  test('declare and read at top level', () => {
    const result = executeTacitCode(`
      100 global a
      a
    `);
    expect(result).toEqual([100]);
  });

  test('assign at top level', () => {
    const result = executeTacitCode(`
      5 global g
      200 -> g
      g
    `);
    expect(result).toEqual([200]);
  });

  test('access inside function', () => {
    const result = executeTacitCode(`
      42 global answer
      : f answer ;
      f
    `);
    expect(result).toEqual([42]);
  });

  test('compound global initialization supports list semantics', () => {
    const result = executeTacitCode(`
      ( 1 2 ) global xs
      xs length
    `);
    expect(result[0]).toEqual(2);
  });

});
