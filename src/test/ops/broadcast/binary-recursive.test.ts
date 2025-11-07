import { fromTaggedValue, Tag } from '../../../../src/core';
import { vm } from '../../../../src/lang/runtime';
import { executeTacitCode, resetVM } from '../../utils/vm-test-utils';
import { getStackData } from '../../../../src/core/vm';

describe('Recursive broadcasting: add', () => {
  afterEach(() => {
    resetVM();
  });

  const snapshotValues = () => getStackData(vm).map((v: number) => fromTaggedValue(v));

  test('scalar broadcast over nested list (scalar on left)', () => {
    executeTacitCode('5 ( ( 1 2 ) 3 ) add');
    const summary = snapshotValues();
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
    expect(() => executeTacitCode('"foo" 1 add')).toThrow('broadcast type mismatch');
  });
});
