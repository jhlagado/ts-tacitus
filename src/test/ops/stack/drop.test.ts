import { describe, test, expect, beforeEach } from '@jest/globals';
import { Tag, toTaggedValue } from '../../../core/tagged';
import { dropOp } from '../../../ops/stack';
import { push, getStackData } from '../../../core/vm';
import { createVM, VM } from '../../../core';

describe('drop Operation', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('simple values', () => {
    test('should drop a regular value from the stack', () => {
      push(vm, 1);
      push(vm, 2);

      dropOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(1);
      expect(stack[0]).toBe(1);
    });

    test('should drop the top value leaving others intact', () => {
      push(vm, 10);
      push(vm, 20);
      push(vm, 30);

      dropOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(2);
      expect(stack[0]).toBe(10);
      expect(stack[1]).toBe(20);
    });
  });

  describe('list operations (LIST semantics)', () => {
    test('should drop an entire simple list', () => {
      push(vm, 10);
      push(vm, 20);
      push(vm, toTaggedValue(2, Tag.LIST));
      dropOp(vm);
      expect(getStackData(vm)).toEqual([]);
    });

    test('should drop a list while leaving other values on stack', () => {
      push(vm, 5);
      push(vm, 1);
      push(vm, 2);
      push(vm, toTaggedValue(2, Tag.LIST));
      dropOp(vm);
      const stack = getStackData(vm);
      expect(stack).toEqual([5]);
    });

    test('should drop multiple lists consecutively', () => {
      push(vm, 10);
      push(vm, 20);
      push(vm, toTaggedValue(2, Tag.LIST));
      push(vm, 30);
      push(vm, 40);
      push(vm, toTaggedValue(2, Tag.LIST));

      dropOp(vm);
      let stack = getStackData(vm);
      expect(stack.length).toBe(3);

      dropOp(vm);
      stack = getStackData(vm);
      expect(stack.length).toBe(0);
    });
  });

  describe('error cases', () => {
    test('should throw on empty stack', () => {
      expect(() => dropOp(vm)).toThrow('Stack underflow');
    });
  });
});
