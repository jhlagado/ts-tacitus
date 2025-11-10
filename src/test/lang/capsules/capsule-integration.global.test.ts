import { executeTacitCode } from '../../utils/vm-test-utils';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../../core';

describe('Capsule with global variable', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('capsule stored in global can be dispatched', () => {
    const code = `
      : make-counter
        0 var count
        capsule case
          'inc of 1 +> count ;
          'get of count ;
        ;
      ;

      make-counter global gc
      'inc &gc dispatch
      'inc &gc dispatch
      'get &gc dispatch
    `;

    const result = executeTacitCode(vm, code);
    const last = result[result.length - 1];
    expect(last).toBe(2);
  });
});
