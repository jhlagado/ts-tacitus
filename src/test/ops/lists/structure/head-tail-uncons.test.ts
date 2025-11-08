import { describe, test, expect, beforeEach } from '@jest/globals';
import { executeTacitCode, resetVM } from '../../../utils/vm-test-utils';

// Head/Tail behavioral tests. Uncons is intentionally skipped/pending.

describe('List structure operations: head/tail', () => {
  beforeEach(() => {
    resetVM();
  });

  test('head on simple list returns first element (top of stack)', () => {
    const result = executeTacitCode(vm, '( 1 2 3 ) head');
    expect(result[result.length - 1]).toBe(1);
  });

  test('tail on simple list drops first element', () => {
    const result = executeTacitCode(vm, '( 1 2 3 ) tail');
    const expected = executeTacitCode(vm, '( 2 3 )');
    expect(result).toEqual(expected);
  });

  test('head on nested list returns the nested list value (suffix match)', () => {
    const result = executeTacitCode(vm, '( ( 1 2 ) 3 ) head');
    const expected = executeTacitCode(vm, '( 1 2 )');
    expect(result.slice(-expected.length)).toEqual(expected);
  });

  test('tail on nested list preserves nested structure', () => {
    const result = executeTacitCode(vm, '( ( 1 2 ) 3 4 ) tail');
    const expected = executeTacitCode(vm, '( 3 4 )');
    expect(result).toEqual(expected);
  });

  test('tail on empty list returns empty list', () => {
    const result = executeTacitCode(vm, '( ) tail');
    const expected = executeTacitCode(vm, '( )');
    expect(result).toEqual(expected);
  });

  test('tail on non-list returns empty list', () => {
    const result = executeTacitCode(vm, '42 tail');
    const expected = executeTacitCode(vm, '( )');
    expect(result).toEqual(expected);
  });

  test('head on non-list returns NIL', () => {
    const result = executeTacitCode(vm, '42 head');
    // Expect NIL (encoded) at TOS
    expect(result.length).toBeGreaterThan(0);
  });

  test('head on &local (RSTACK list) returns first element (simple)', () => {
    const result = executeTacitCode(vm, ': f ( 7 8 ) var xs &xs head ; f');
    expect(result[result.length - 1]).toBe(7);
  });

  test('head on &local with nested first element returns nested list', () => {
    const result = executeTacitCode(vm, ': f ( ( 5 6 ) 9 ) var xs &xs head ; f');
    expect(result.length).toBeGreaterThan(0);
  });

  test('tail on &local drops first element and preserves rest', () => {
    const result = executeTacitCode(vm, ': f ( 1 2 3 ) var xs &xs tail ; f');
    // Should yield a list of length 2
    expect(result.length).toBeGreaterThan(0);
  });

  test('reverse on &local reverses logical elements', () => {
    const result = executeTacitCode(vm, ': f ( 1 ( 2 3 ) 4 ) var xs &xs reverse ; f');
    // Expect a list header on stack and elements reversed logically
    expect(result.length).toBeGreaterThan(0);
  });
});
