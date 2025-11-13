import { describe, test, expect, beforeEach } from '@jest/globals';
import { Tag, getTaggedInfo, createVM, VM } from '../../../core';
import { binaryFlat } from '../../../ops/broadcast';
import { extractListFromStack, executeTacitCode } from '../../utils/vm-test-utils';
import { getStackData } from '../../../core/vm';

describe('broadcast helpers - scalar × list', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('scalar × list applies op across RHS payload', () => {
    executeTacitCode(vm, '5 ( 1 2 3 )', true);

    binaryFlat(vm, 'add', (a, b) => a + b);

    const stack = getStackData(vm);
    // Find the LIST header (should be at TOS)
    let headerIndex = -1;
    for (let i = stack.length - 1; i >= 0; i--) {
      const { tag } = getTaggedInfo(stack[i]);
      if (tag === Tag.LIST) {
        headerIndex = i;
        break;
      }
    }
    expect(headerIndex).toBeGreaterThanOrEqual(0);
    const actual = extractListFromStack(stack, headerIndex);
    expect(actual.slice().reverse()).toEqual([6, 7, 8]);
  });
});
