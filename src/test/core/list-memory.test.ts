import { describe, it, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../core';
import { executeProgram } from '../../lang/interpreter';
import { fromTaggedValue, Tag } from '../../core';
import { getStackData, peek } from '../../core/vm';

function stackDepth(vm: VM): number {
  return getStackData(vm).length;
}

describe('LIST Memory Management Validation', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  it('creates and drops a large LIST without leaving residual stack data', () => {
    executeProgram(vm, '( 1 2 3 4 5 6 7 8 9 10 )');
    const before = stackDepth(vm);
    expect(before).toBe(11);

    const { tag } = fromTaggedValue(peek(vm));
    expect(tag).toBe(Tag.LIST);

    executeProgram(vm, 'drop');
    expect(stackDepth(vm)).toBe(0);
  });

  it('handles nested LIST creation and drop in sequence', () => {
    executeProgram(vm, '( 1 ( 2 3 ) 4 )');
    expect(stackDepth(vm)).toBeGreaterThan(0);
    executeProgram(vm, 'drop');
    expect(stackDepth(vm)).toBe(0);
  });
});
