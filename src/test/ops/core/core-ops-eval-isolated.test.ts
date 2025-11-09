import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../../core';
import { executeTacitCode } from '../../utils/vm-test-utils';

describe('Core Operations Eval (Isolated)', () => {
  let vm: VM;

  beforeEach(() => {
    // Disable caching for this test to avoid isolation issues
    vm = createVM();
  });

  test('should exercise eval with colon definition', () => {
    const result = executeTacitCode(
      vm,
      `
        : inc 1 add ;
        41 @inc eval
      `,
    );

    expect(result).toEqual([42]);
  });
});
