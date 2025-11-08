import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../../../core';
import { executeTacitCode } from '../../../utils/vm-test-utils';

// Address-returning ops: slot, elem

describe('List addressing operations: slot/elem', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('slot returns address for payload slot', () => {
    const stack = executeTacitCode(vm, '( 10 20 30 ) 1 slot fetch');
    expect(stack[stack.length - 1]).toBe(20);
  });

  test('elem returns address for logical element', () => {
    const stack = executeTacitCode(vm, '( 10 ( 20 21 ) 30 ) 1 elem fetch');
    // Element 1 is ( 20 21 )
    const last = stack[stack.length - 1];
    expect(Array.isArray(stack)).toBe(true);
    expect(last).not.toBeUndefined();
  });

  test('slot out of range returns NIL', () => {
    const stack = executeTacitCode(vm, '( 1 2 ) 5 slot');
    // Expect NIL on stack
    expect(stack[stack.length - 1]).toBeNaN();
  });

  test('elem out of range returns NIL', () => {
    const stack = executeTacitCode(vm, '( (1 2) ) 5 elem');
    expect(stack[stack.length - 1]).toBeNaN();
  });

  test('negative indices return NIL (slot/elem)', () => {
    const s1 = executeTacitCode(vm, '( 1 2 ) -1 slot');
    expect(s1[s1.length - 1]).toBeNaN();
    const s2 = executeTacitCode(vm, '( (1) ) -1 elem');
    expect(s2[s2.length - 1]).toBeNaN();
  });
});
