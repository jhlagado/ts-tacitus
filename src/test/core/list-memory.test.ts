import { describe, it, expect, beforeEach } from '@jest/globals';
import { initializeInterpreter, vm } from '../../lang/runtime';
import { executeProgram } from '../../lang/interpreter';
import { fromTaggedValue, Tag } from '../../core';
import { getStackData, peek } from '../../core/vm';

function stackDepth(): number {
  return getStackData(vm).length;
}

describe('LIST Memory Management Validation', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  it('creates and drops a large LIST without leaving residual stack data', () => {
    executeProgram('( 1 2 3 4 5 6 7 8 9 10 )');
    const before = stackDepth();
    expect(before).toBe(11);

    const { tag } = fromTaggedValue(peek(vm));
    expect(tag).toBe(Tag.LIST);

    executeProgram('drop');
    expect(stackDepth()).toBe(0);
  });

  it('handles nested LIST creation and drop in sequence', () => {
    executeProgram('( 1 ( 2 3 ) 4 )');
    expect(stackDepth()).toBeGreaterThan(0);
    executeProgram('drop');
    expect(stackDepth()).toBe(0);
  });
});
