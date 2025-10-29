import { describe, test, expect } from '@jest/globals';
import { executeTacitCode, resetVM } from '../utils/vm-test-utils';
import { vm } from '../../lang/runtime';
import {
  decodeDataRef,
  CELL_SIZE,
  toTaggedValue,
  Tag,
  NIL,
  getTag,
  fromTaggedValue,
  SEG_DATA,
  GLOBAL_BASE,
  GLOBAL_SIZE,
  getRefRegion,
} from '../../core';
import { Tokenizer } from '../../lang/tokenizer';
import { parse } from '../../lang/parser';
import { execute } from '../../lang/interpreter';

describe('Global variables (unified data + GLOBAL_REF)', () => {
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

  test('bracket-path update of global list element (path exercised)', () => {
    const result = executeTacitCode(`
      ( 1 2 ) global xs
      9 -> xs[0]
      xs length
    `);
    expect(result[0]).toEqual(2);
  });

  test('incompatible compound reassignment errors', () => {
    expect(() =>
      executeTacitCode(`
      ( 1 2 ) global xs
      ( 1 2 3 ) -> xs
    `),
    ).toThrow(/Incompatible compound assignment/);
  });

  test('simple to compound mismatch errors', () => {
    expect(() =>
      executeTacitCode(`
      ( 1 2 ) global xs
      42 -> xs
    `),
    ).toThrow(/Cannot assign simple to compound or compound to simple/);
  });

  test('global segment exhaustion throws on compound init overflow', () => {
    const cells = (GLOBAL_SIZE) / CELL_SIZE; // capacity in cells
    const N = Math.floor(cells) + 64; // exceed capacity comfortably
    const makeN = Array.from({ length: N }, () => '1').join(' ');
    const code = `
      ( ${makeN} ) global g1
      ( ${makeN} ) global g2
    `;
    expect(() => executeTacitCode(code)).toThrow(/(Global heap exhausted|outside segment)/);
  });

  // The following two legacy-structure tests have been removed.
  // Heap-backed dictionary structure is validated by dict-specific suites.
});
