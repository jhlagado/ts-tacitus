import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../../../core';
import { executeTacitCode } from '../../../utils/vm-test-utils';
import { getTaggedInfo, Tag, isNIL } from '../../../../core/tagged';

describe('List build ops (pack/unpack) unified memory coverage', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('pack with count 0 creates empty list', () => {
    const stack = executeTacitCode(vm, '0 pack');
    const last = stack[stack.length - 1];
    const { tag: lastTag } = getTaggedInfo(last);
    expect(lastTag).toBe(Tag.LIST);
  });

  test('pack with count > stack length yields NIL', () => {
    const stack = executeTacitCode(vm, '1 2 5 pack');
    const last = stack[stack.length - 1];
    expect(isNIL(last)).toBe(true);
  });

  // Pack exact count is covered elsewhere; no extra assertion here.

  test('unpack on non-list leaves stack in a valid state', () => {
    const stack = executeTacitCode(vm, '42 unpack');
    expect(Array.isArray(stack)).toBe(true);
    expect(stack.length).toBeGreaterThan(0);
  });

  test('unpack on empty list yields no items', () => {
    const stack = executeTacitCode(vm, '( ) unpack');
    expect(stack.length).toBe(0);
  });

  test('unpack on stack-resident list leaves payload on stack', () => {
    const stack = executeTacitCode(vm, '( 1 2 ) unpack');
    expect(stack).toEqual([2, 1]);
  });
});
