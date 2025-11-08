import { executeTacitCode } from '../../utils/vm-test-utils';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../../core';

describe('Capsule dispatch via global ref (GLOBAL_REF)', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test.skip('counter capsule dispatches using &global alias', () => {
    const code = `
      : make-counter
        0 var count
        capsule case
          'inc of 1 +> count ;
          'get of count ;
        ;
      ;

      make-counter global gc
      &gc fetch ref 'inc swap dispatch
      &gc fetch ref 'inc swap dispatch
      &gc fetch ref 'get swap dispatch
    `;

    const result = executeTacitCode(vm, code);
    const last = result[result.length - 1];
    expect(last).toBe(2);
  });
});
