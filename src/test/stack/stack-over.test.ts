/**
 * Tests for the 'over' stack operation
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { VM } from '../../core/vm';
import { overOp } from '../../ops/builtins-stack';
import { fromTaggedValue, Tag } from '../../core/tagged';
import { executeTacitCode, resetVM } from '../utils/test-utils';

describe('over Operation', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
    resetVM();
  });

  test('should duplicate the second item (simple values)', () => {
    vm.push(1);
    vm.push(2);

    overOp(vm);

    expect(vm.getStackData()).toEqual([1, 2, 1]);
  });

  test('should duplicate a list when it is the second item', () => {
    const stack = executeTacitCode('( 1 2 ) 100 over');

    expect(stack.length).toBe(9);

    const { tag: list1Tag, value: list1Size } = fromTaggedValue(stack[0]);
    expect(list1Tag).toBe(Tag.LIST);
    expect(list1Size).toBe(2);
    expect(stack[1]).toBe(1);
    expect(stack[2]).toBe(2);

    const { tag: link1Tag } = fromTaggedValue(stack[3]);
    expect(link1Tag).toBe(Tag.LINK);

    expect(stack[4]).toBe(100);

    const { tag: list2Tag, value: list2Size } = fromTaggedValue(stack[5]);
    expect(list2Tag).toBe(Tag.LIST);
    expect(list2Size).toBe(2);
    expect(stack[6]).toBe(1);
    expect(stack[7]).toBe(2);

    const { tag: link2Tag } = fromTaggedValue(stack[8]);
    expect(link2Tag).toBe(Tag.LINK);
  });

  test('should throw on insufficient stack', () => {
    expect(() => overOp(vm)).toThrow('requires 2 operands');

    vm.push(1);
    expect(() => overOp(vm)).toThrow('requires 2 operands');
  });
});
