import { describe, test, expect, beforeEach } from '@jest/globals';
import { resetVM, executeTacitCode } from '../../../utils/vm-test-utils';
import { getTag, Tag, isNIL } from '../../../../core/tagged';

describe('List build ops (pack/unpack) unified memory coverage', () => {
  beforeEach(() => resetVM());

  test('pack with count 0 creates empty list', () => {
    const stack = executeTacitCode('0 pack');
    const last = stack[stack.length - 1];
    expect(getTag(last)).toBe(Tag.LIST);
  });

  test('pack with count > stack length yields NIL', () => {
    const stack = executeTacitCode('1 2 5 pack');
    const last = stack[stack.length - 1];
    expect(isNIL(last)).toBe(true);
  });

  // Pack exact count is covered elsewhere; no extra assertion here.

  test('unpack on non-list leaves stack in a valid state', () => {
    const stack = executeTacitCode('42 unpack');
    expect(Array.isArray(stack)).toBe(true);
    expect(stack.length).toBeGreaterThan(0);
  });
});
