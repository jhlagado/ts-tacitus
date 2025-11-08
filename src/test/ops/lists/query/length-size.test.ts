import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../../../core';
import { executeTacitCode } from '../../../utils/vm-test-utils';

describe('List query operations: length/size', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('length returns slot count for simple list', () => {
    const stack = executeTacitCode(vm, '( 1 2 3 ) length');
    expect(stack[stack.length - 1]).toBe(3);
  });

  test('size returns element count for simple list', () => {
    const stack = executeTacitCode(vm, '( 1 ( 2 3 ) 4 ) size');
    // Elements: 1, (2 3), 4 => 3 elements
    expect(stack[stack.length - 1]).toBe(3);
  });

  test('size works on return-stack list reference (&local)', () => {
    const result = executeTacitCode(vm, ': f ( 1 2 ) var x &x size ; f');
    expect(result[0]).toBe(2);
  });

  test('size on &local empty list returns 0', () => {
    const result = executeTacitCode(vm, ': f ( ) var x &x size ; f');
    expect(result[0]).toBe(0);
  });

  test('length on &local empty list returns 0', () => {
    const result = executeTacitCode(vm, ': f ( ) var x &x length ; f');
    expect(result[0]).toBe(0);
  });

  test('length for non-list returns NIL', () => {
    const stack = executeTacitCode(vm, '42 length');
    expect(Number.isNaN(stack[stack.length - 1])).toBe(true);
  });

  test('size for non-list returns NIL', () => {
    const stack = executeTacitCode(vm, '42 size');
    expect(Number.isNaN(stack[stack.length - 1])).toBe(true);
  });
});
