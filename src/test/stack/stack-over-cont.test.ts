/**
 * Additional tests for the 'over' stack operation
 * Focused on the behavior with lists
 */
import { describe, it, expect } from '@jest/globals';
import { fromTaggedValue, Tag } from '../../core/tagged';
import { executeTacitCode } from '../utils/test-utils';

describe('over Operation (continued)', () => {
  test('should duplicate the second item (list)', () => {
    const stack = executeTacitCode('100 ( 10 20 ) over');

    expect(stack.length).toBe(6);

    expect(stack[0]).toBe(100);

    const { tag: listTag, value: listSize } = fromTaggedValue(stack[1]);
    expect(listTag).toBe(Tag.LIST);
    expect(listSize).toBe(2);
    expect(stack[2]).toBe(10);
    expect(stack[3]).toBe(20);

    const { tag: linkTag } = fromTaggedValue(stack[4]);
    expect(linkTag).toBe(Tag.LINK);

    expect(stack[5]).toBe(100);
  });
});
