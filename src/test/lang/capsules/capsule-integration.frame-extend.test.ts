import { executeTacitCode } from '../../utils/vm-test-utils';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../../core';

describe('Capsule stored in function local (frame extension)', () => {
  let vm: VM;

  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('function creates counter capsule, stores in local, dispatches', () => {
    const code = `
      : make-counter
        0 var count

        capsule case
          'inc of 1 +> count ;
          'get of count ;
        ;
      ;

      : use-counter
        make-counter var c
        'inc &c dispatch
        'inc &c dispatch
        'get &c dispatch
      ;
      use-counter
    `;

    const stack = executeTacitCode(vm, code);
    // After calling use-counter, the last value should be 2
    expect(stack[stack.length - 1]).toBe(2);
  });
});
