import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../../../core';
import { executeTacitCode } from '../../../utils/vm-test-utils';

// Basic integration tests for parser-driven open/close list semantics

describe('List parser integration: open/close', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('basic roundtrip ( ) parses to LIST header and payload (behavioral)', () => {
    const stack = executeTacitCode(vm, '( 10 20 ) unpack');
    // unpack leaves 20 at TOS then 10 beneath
    expect(stack.slice(-2)).toEqual([20, 10]);
  });

  test('nested lists parse correctly', () => {
    const stack = executeTacitCode(vm, '( 1 ( 2 3 ) 4 )');
    // Roundtrip property: reversing twice preserves
    const doubleReverse = executeTacitCode(vm, '( 1 ( 2 3 ) 4 ) reverse reverse');
    expect(doubleReverse).toEqual(stack);
  });
});
