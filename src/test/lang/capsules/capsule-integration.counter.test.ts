import { executeTacitCode } from '../../utils/vm-test-utils';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../../core';

describe('Counter capsule (case/of)', () => {
  let vm: VM;

  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('inc and get update and read state via dispatch', () => {
    const code = `
      : make-counter
        0 var count

        capsule case
          'inc of 1 +> count ;
          'get of count ;
        ;
      ;

      make-counter dup
      'inc swap dispatch
      'get swap dispatch
    `;

    const stack = executeTacitCode(vm, code);
    // Final value should be current count = 1
    const last = stack[stack.length - 1];
    expect(last).toBe(1);
  });
});
