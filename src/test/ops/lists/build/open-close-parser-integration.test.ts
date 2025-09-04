import { describe, test, expect, beforeEach } from '@jest/globals';
import { executeTacitCode, resetVM } from '../../../utils/vm-test-utils';

// Basic integration tests for parser-driven open/close list semantics

describe('List parser integration: open/close', () => {
  beforeEach(() => {
    resetVM();
  });

  test('basic roundtrip ( ) parses to LIST header and payload (behavioral)', () => {
    const stack = executeTacitCode('( 10 20 ) unpack');
    // unpack leaves 20 at TOS then 10 beneath
    expect(stack.slice(-2)).toEqual([20, 10]);
  });

  test('nested lists parse correctly', () => {
    const stack = executeTacitCode('( 1 ( 2 3 ) 4 )');
    // Roundtrip property: reversing twice preserves
    const doubleReverse = executeTacitCode('( 1 ( 2 3 ) 4 ) reverse reverse');
    expect(doubleReverse).toEqual(stack);
  });
});
