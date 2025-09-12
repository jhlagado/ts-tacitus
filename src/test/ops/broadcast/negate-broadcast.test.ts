import { toTaggedValue, Tag } from '../../../core/tagged';
import { executeTacitCode, resetVM } from '../../utils/vm-test-utils';

describe('Unary broadcasting: neg', () => {
  beforeEach(() => resetVM());

  test('simple value', () => {
    const stack = executeTacitCode('5 neg');
    expect(stack).toEqual([-5]);
  });

  test('flat list', () => {
    const stack = executeTacitCode('( 1 2 3 ) neg');
    expect(stack).toEqual([-1, -2, -3, toTaggedValue(3, Tag.LIST)]);
  });

  test('nested list', () => {
    const stack = executeTacitCode('( ( 1 2 ) 3 ) neg');
    // Expected: ( ( -1 -2 ) -3 )
    expect(stack).toEqual([
      -1, -2, toTaggedValue(2, Tag.LIST), // inner
      -3,
      toTaggedValue(3, Tag.LIST), // 2 payload + 1 header (inner) + 1 simple = 4 slots, header payload count = 3
    ]);
  });

  test('empty list', () => {
    const stack = executeTacitCode('( ) neg');
    expect(stack).toEqual([toTaggedValue(0, Tag.LIST)]);
  });
});

