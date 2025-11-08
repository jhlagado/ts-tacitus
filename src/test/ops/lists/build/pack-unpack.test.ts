import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../../../core';
import { executeTacitCode } from '../../../utils/vm-test-utils';

describe('List build operations: pack/unpack/enlist', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('pack builds list from n items (behavioral)', () => {
    const stack = executeTacitCode(vm, '1 2 3 3 pack unpack');
    expect(stack.slice(-3)).toEqual([1, 2, 3]);
  });

  test('unpack pushes list elements', () => {
    const stack = executeTacitCode(vm, '1 2 3 3 pack unpack');
    // After unpack, elements remain (no header)
    expect(stack.slice(-3)).toEqual([1, 2, 3]);
  });

  test('enlist converts value to single-element list', () => {
    const stack = executeTacitCode(vm, '42 enlist');
    const expected = executeTacitCode(vm, '( 42 )');
    expect(stack).toEqual(expected);
  });

  test('pack with zero count yields empty list', () => {
    const stack = executeTacitCode(vm, '0 pack');
    const expected = executeTacitCode(vm, '( )');
    expect(stack).toEqual(expected);
  });
});
