import { describe, test, expect, beforeEach } from '@jest/globals';
import { executeTacitCode, resetVM } from '../../../utils/vm-test-utils';

describe('List query operations: length/size', () => {
  beforeEach(() => {
    resetVM();
  });

  test('length returns slot count for simple list', () => {
    const stack = executeTacitCode('( 1 2 3 ) length');
    expect(stack[stack.length - 1]).toBe(3);
  });

  test('size returns element count for simple list', () => {
    const stack = executeTacitCode('( 1 ( 2 3 ) 4 ) size');
    // Elements: 1, (2 3), 4 => 3 elements
    expect(stack[stack.length - 1]).toBe(3);
  });

  test('length for non-list returns NIL', () => {
    const stack = executeTacitCode('42 length');
    expect(Number.isNaN(stack[stack.length - 1])).toBe(true);
  });

  test('size for non-list returns NIL', () => {
    const stack = executeTacitCode('42 size');
    expect(Number.isNaN(stack[stack.length - 1])).toBe(true);
  });
});
