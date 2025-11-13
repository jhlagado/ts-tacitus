import { describe, test, expect, beforeEach } from '@jest/globals';
import { getTaggedInfo, Tag, createVM, VM } from '../../../../src/core';
import { executeTacitCode } from '../../utils/vm-test-utils';
import { getStackData } from '../../../../src/core/vm';

describe('Recursive broadcasting: add', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  const snapshotValues = (testVM: VM) => getStackData(testVM).map((v: number) => getTaggedInfo(v));

  test('scalar broadcast over nested list (scalar on left)', () => {
    executeTacitCode(vm, '5 ( ( 1 2 ) 3 ) add');
    const summary = snapshotValues(vm);
    expect(summary).toEqual([
      { value: 2, tag: Tag.LIST, meta: 0 },
      { value: 6, tag: Tag.NUMBER, meta: 0 },
      { value: 7, tag: Tag.NUMBER, meta: 0 },
      { value: 8, tag: Tag.NUMBER, meta: 0 },
      { value: 4, tag: Tag.LIST, meta: 0 },
    ]);
  });

  // Removed unfinished recursive broadcasting tests (former test.skip)

  test('type mismatch surfaces broadcast error', () => {
    expect(() => executeTacitCode(vm, '"foo" 1 add')).toThrow('broadcast type mismatch');
  });
});
