import { fromTaggedValue, Tag } from '../../../../src/core';
import { vm } from '../../../../src/core/global-state';
import { executeTacitCode, resetVM } from '../../utils/vm-test-utils';

describe('Recursive broadcasting: add', () => {
  afterEach(() => {
    resetVM();
  });

  const snapshotValues = () => vm.getStackData().map((v: number) => fromTaggedValue(v));

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

  test.skip('scalar broadcast over nested list (scalar on right)', () => {
    executeTacitCode('( ( 1 2 ) 3 ) 5 add');
    const summary = snapshotValues();
    expect(summary).toEqual([
      { value: 2, tag: Tag.LIST, meta: 0 },
      { value: 6, tag: Tag.NUMBER, meta: 0 },
      { value: 7, tag: Tag.NUMBER, meta: 0 },
      { value: 8, tag: Tag.NUMBER, meta: 0 },
      { value: 4, tag: Tag.LIST, meta: 0 },
    ]);
  });

  test.skip('nested list combined with nested list', () => {
    executeTacitCode('( ( 1 2 ) 3 ) ( ( 10 20 ) 30 ) add');
    const summary = snapshotValues();
    expect(summary).toEqual([
      { value: 2, tag: Tag.LIST, meta: 0 },
      { value: 11, tag: Tag.NUMBER, meta: 0 },
      { value: 22, tag: Tag.NUMBER, meta: 0 },
      { value: 33, tag: Tag.NUMBER, meta: 0 },
      { value: 4, tag: Tag.LIST, meta: 0 },
    ]);
  });

  test.skip('list length cycling matches longer operand', () => {
    executeTacitCode('( 1 2 ) ( 10 20 30 ) add');
    const summary = snapshotValues();
    console.log('cycle summary', summary);
    expect(summary).toEqual([
      { value: 11, tag: Tag.NUMBER, meta: 0 },
      { value: 22, tag: Tag.NUMBER, meta: 0 },
      { value: 31, tag: Tag.NUMBER, meta: 0 },
      { value: 3, tag: Tag.LIST, meta: 0 },
    ]);
  });

  test.skip('empty lists produce empty list result', () => {
    executeTacitCode('0 pack 0 pack add');
    const summary = snapshotValues();
    console.log('empty summary', summary);
    expect(summary).toEqual([{ value: 0, tag: Tag.LIST, meta: 0 }]);
  });

  test('type mismatch surfaces broadcast error', () => {
    expect(() => executeTacitCode('"foo" 1 add')).toThrow('broadcast type mismatch');
  });
});
