import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM } from '../../../core/vm';
import { executeTacitCode } from '../../utils/vm-test-utils';
import { Tag, getTaggedInfo } from '../../../core/tagged';

describe('Global Variable Access: Address-of Inside Function', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('should access global with address-of inside function', () => {
    executeTacitCode(vm, '(1 2 3) global myList');
    const code = `
      : getRef
        &myList
      ;
      getRef
    `;
    const stack = executeTacitCode(vm, code);
    // For compounds, Fetch returns the REF stored in the cell
    const ref = stack[stack.length - 1];
    const { tag: refTag } = getTaggedInfo(ref);
    expect(refTag).toBe(Tag.REF);
  });
});
