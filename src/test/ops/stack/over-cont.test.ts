import { describe, it, expect } from '@jest/globals';
import { fromTaggedValue, Tag } from '../../../core/tagged';
import { executeTacitCode } from '../../utils/test-utils';

describe('over Operatio cont', () => {
  test('should duplicate the second item (list)', () => {
    // Create a stack with a value and a list, then apply 'over'
    // This executes: 100 ( 10 20 ) over
    // Which should put a copy of 100 on top of the stack
    const stack = executeTacitCode('100 ( 10 20 ) over');

    // We expect: [100, LIST(2), 10, 20, LINK, 100]
    expect(stack.length).toBe(6);

    // First element should be 100
    expect(stack[0]).toBe(100);

    // Then we expect a list [10, 20]
    const { tag: listTag, value: listSize } = fromTaggedValue(stack[1]);
    expect(listTag).toBe(Tag.LIST);
    expect(listSize).toBe(2);
    expect(stack[2]).toBe(10);
    expect(stack[3]).toBe(20);

    const { tag: linkTag } = fromTaggedValue(stack[4]);
    expect(linkTag).toBe(Tag.LINK);

    // Then we expect the duplicated 100
    expect(stack[5]).toBe(100);
  });
});
