import { describe, test, expect, beforeEach } from '@jest/globals';
import { executeTacitCode, resetVM } from '../../../utils/vm-test-utils';

// Address-returning ops: slot, elem

describe('List addressing operations: slot/elem', () => {
  beforeEach(() => {
    resetVM();
  });

  test('slot returns address for payload slot', () => {
    const stack = executeTacitCode('( 10 20 30 ) 1 slot fetch');
    expect(stack[stack.length - 1]).toBe(20);
  });

  test('elem returns address for logical element', () => {
    const stack = executeTacitCode('( 10 ( 20 21 ) 30 ) 1 elem fetch');
    // Element 1 is ( 20 21 )
    const last = stack[stack.length - 1];
    expect(Array.isArray(stack)).toBe(true);
    expect(last).not.toBeUndefined();
  });
});
