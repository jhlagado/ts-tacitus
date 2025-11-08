import { describe, it, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../core';
import { executeTacitCode } from '../utils/vm-test-utils';
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
    // First verify list creation works
    const stackWithList = executeTacitCode(vm, '( 1 2 3 4 5 6 7 8 9 10 )');
    expect(stackWithList.length).toBe(11); // 10 numbers + 1 list header
    
    // Now drop it - preserve stack between calls
    const stackAfter = executeTacitCode(vm, 'drop', false);
    expect(stackAfter.length).toBe(0);
    expect(stackDepth(vm)).toBe(0);
  });

  it('handles nested LIST creation and drop in sequence', () => {
    // First verify nested list creation works
    const stackWithList = executeTacitCode(vm, '( 1 ( 2 3 ) 4 )');
    expect(stackWithList.length).toBeGreaterThan(0);
    
    // Now drop it - preserve stack between calls
    const stackAfter = executeTacitCode(vm, 'drop', false);
    expect(stackAfter.length).toBe(0);
    expect(stackDepth(vm)).toBe(0);
  });
});
