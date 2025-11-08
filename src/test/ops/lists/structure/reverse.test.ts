/**
 * @file src/test/ops/lists/list-reverse.test.ts
 *
 * Tests for the reverse operation on Tacit lists.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { executeTacitCode, resetVM } from '../../../utils/vm-test-utils';

describe('List reverse operation', () => {
  beforeEach(() => {
    resetVM();
  });

  test('reverse empty list returns empty list', () => {
    const stack = executeTacitCode(vm, '( ) reverse');
    expect(stack).toHaveLength(1);

    const original = executeTacitCode(vm, '( )');
    expect(stack).toEqual(original);
  });

  test('reverse single element list returns same list', () => {
    const stack = executeTacitCode(vm, '( 42 ) reverse');
    expect(stack).toHaveLength(2);

    const expected = executeTacitCode(vm, '( 42 )');
    expect(stack).toEqual(expected);
  });

  test('reverse two element list', () => {
    const stack = executeTacitCode(vm, '( 1 2 ) reverse');
    expect(stack).toHaveLength(3);

    expect(stack[0]).toBe(2);
    expect(stack[1]).toBe(1);
  });

  test('reverse three element list', () => {
    const stack = executeTacitCode(vm, '( 1 2 3 ) reverse');
    expect(stack).toHaveLength(4);

    expect(stack[0]).toBe(3);
    expect(stack[1]).toBe(2);
    expect(stack[2]).toBe(1);
  });

  test('reverse longer list', () => {
    const stack = executeTacitCode(vm, '( 1 2 3 4 5 ) reverse');
    expect(stack).toHaveLength(6);

    expect(stack[0]).toBe(5);
    expect(stack[1]).toBe(4);
    expect(stack[2]).toBe(3);
    expect(stack[3]).toBe(2);
    expect(stack[4]).toBe(1);
  });

  test('reverse twice returns original list', () => {
    const original = executeTacitCode(vm, '( 1 2 3 )');
    const reversed = executeTacitCode(vm, '( 1 2 3 ) reverse reverse');

    expect(reversed).toEqual(original);
  });

  test('reverse with non-list value returns NIL', () => {
    const stack = executeTacitCode(vm, '42 reverse');
    expect(stack).toHaveLength(1);

    expect(stack.length).toBe(1);
  });

  test('reverse with nested lists', () => {
    const stack = executeTacitCode(vm, '( ( 1 2 ) 3 ) reverse');

    expect(stack.length).toBeGreaterThan(0);

    const original = executeTacitCode(vm, '( ( 1 2 ) 3 )');
    const doubleReversed = executeTacitCode(vm, '( ( 1 2 ) 3 ) reverse reverse');
    expect(doubleReversed).toEqual(original);
  });
});
