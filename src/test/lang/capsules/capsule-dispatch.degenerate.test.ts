import { executeTacitCode } from '../../utils/vm-test-utils';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../../core';

describe('Capsule dispatch (degenerate body)', () => {
  let vm: VM;

  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('dispatch ignores message and returns constant', () => {
    const code =
      `
      : mk
        capsule
        123
      ;
      mk
      ` +
      // args… method receiver dispatch ; no args, swap to put receiver last
      " 'any swap dispatch ";

    const stack = executeTacitCode(vm, code);
    // Expect the constant on stack
    expect(stack[stack.length - 1]).toBe(123);
  });
});
