import { describe, test, expect, beforeEach } from '@jest/globals';
import { Tag, Tagged } from '../../../core/tagged';
import { dupOp } from '../../../ops/stack';
import { push, getStackData } from '../../../core/vm';
import { createVM, VM } from '../../../core';

describe('dup Operation', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('simple values', () => {
    test('should duplicate a simple value', () => {
      push(vm, 5);
      dupOp(vm);
      expect(getStackData(vm)).toEqual([5, 5]);
    });

    test('should duplicate a regular value', () => {
      push(vm, 42);
      dupOp(vm);
      expect(getStackData(vm)).toEqual([42, 42]);
    });
  });

  describe('list operations (LIST semantics)', () => {
    test('should duplicate a list', () => {
      push(vm, 10);
      push(vm, 20);
      push(vm, 30);
      push(vm, Tagged(3, Tag.LIST));

      dupOp(vm);

      const stack = getStackData(vm);
      expect(stack.slice(-8)).toEqual([
        10,
        20,
        30,
        Tagged(3, Tag.LIST),
        10,
        20,
        30,
        Tagged(3, Tag.LIST),
      ]);
    });

    test('should duplicate a simple list', () => {
      push(vm, 1);
      push(vm, 2);
      push(vm, Tagged(2, Tag.LIST));

      dupOp(vm);

      const stack = getStackData(vm);
      expect(stack.slice(-6)).toEqual([1, 2, Tagged(2, Tag.LIST), 1, 2, Tagged(2, Tag.LIST)]);
    });

    test('should duplicate a larger list', () => {
      push(vm, 10);
      push(vm, 20);
      push(vm, 30);
      push(vm, Tagged(3, Tag.LIST));

      dupOp(vm);

      const stack = getStackData(vm);
      expect(stack.slice(-8)).toEqual([
        10,
        20,
        30,
        Tagged(3, Tag.LIST),
        10,
        20,
        30,
        Tagged(3, Tag.LIST),
      ]);
    });

    test('should duplicate a nested list', () => {
      push(vm, 2);
      push(vm, 3);
      push(vm, Tagged(2, Tag.LIST));
      push(vm, 1);
      push(vm, 4);
      push(vm, Tagged(3, Tag.LIST));

      const before = getStackData(vm).length;
      dupOp(vm);
      const after = getStackData(vm).length;
      expect(after).toBeGreaterThan(before);
    });
  });

  describe('error cases', () => {
    test('should throw on empty stack', () => {
      expect(() => dupOp(vm)).toThrow(
        `Stack underflow: 'dup' requires 1 operand (stack: ${JSON.stringify(getStackData(vm))})`,
      );
    });
  });
});
