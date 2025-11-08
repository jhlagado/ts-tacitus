import { executeTacitCode } from '../../utils/vm-test-utils';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../../core';

describe('Capsule dispatch via stack REF handle', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test.skip('simple counter capsule dispatches using fetch+ref', () => {
    const code = `
      : make-counter
        0 var count
        capsule case
          'inc of 1 +> count ;
          'get of count ;
        ;
      ;

      make-counter
      fetch
      ref 'inc swap dispatch
      ref 'inc swap dispatch
      ref 'get swap dispatch
    `;

    const result = executeTacitCode(vm, code);
    const last = result[result.length - 1];
    expect(last).toBe(2);
  });
});
