import { describe, test, expect, beforeEach } from '@jest/globals';
import { Tag, Tagged, getTaggedInfo } from '../../../core/tagged';
import {
  dupOp,
  dropOp,
  swapOp,
  overOp,
  rotOp,
  revrotOp,
  pickOp,
  tuckOp,
  nipOp,
  cellsRoll,
  findElement,
} from '../../../ops/stack';
import { push, getStackData } from '../../../core/vm';
import { createVM, VM } from '../../../core';
import { pushListLiteral, pushNumber } from '../../utils/vm-test-utils';

describe('Stack Operations', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('dup', () => {
    test('should duplicate a simple value', () => {
      push(vm, 5);
      dupOp(vm);
      expect(getStackData(vm)).toEqual([5, 5]);
    });

    test('should duplicate a list', () => {
      push(vm, 10);
      push(vm, 20);
      push(vm, Tagged(2, Tag.LIST));
      dupOp(vm);
      const stack = getStackData(vm);
      expect(stack.slice(-6)).toEqual([10, 20, Tagged(2, Tag.LIST), 10, 20, Tagged(2, Tag.LIST)]);
    });
  });

  describe('drop', () => {
    test('should drop top value', () => {
      push(vm, 1);
      push(vm, 2);
      dropOp(vm);
      expect(getStackData(vm)).toEqual([1]);
    });

    test('should drop entire list', () => {
      push(vm, 10);
      push(vm, 20);
      push(vm, Tagged(2, Tag.LIST));
      dropOp(vm);
      expect(getStackData(vm)).toEqual([]);
    });
  });

  describe('swap', () => {
    test('should swap two simple values', () => {
      push(vm, 5);
      push(vm, 10);
      push(vm, 20);
      swapOp(vm);
      expect(getStackData(vm)).toEqual([5, 20, 10]);
    });

    test('should swap top two values on deeper stack', () => {
      push(vm, 5);
      push(vm, 1);
      push(vm, 2);
      push(vm, 3);
      push(vm, 4);
      push(vm, 5);
      push(vm, 10);
      push(vm, 20);
      swapOp(vm);
      expect(getStackData(vm)).toEqual([5, 1, 2, 3, 4, 5, 20, 10]);
    });

    test('should swap a simple list with a value', () => {
      push(vm, 5);
      push(vm, 20);
      push(vm, 30);
      push(vm, Tagged(2, Tag.LIST));
      push(vm, 10);
      swapOp(vm);
      const stack = getStackData(vm);
      expect(stack.length).toBe(5);
    });

    test('should swap a value with a simple list', () => {
      push(vm, 5);
      push(vm, 10);
      push(vm, 20);
      push(vm, 30);
      push(vm, Tagged(2, Tag.LIST));
      swapOp(vm);
      const stack = getStackData(vm);
      expect(stack.length).toBe(5);
      expect(stack[0]).toBe(5);
      expect(stack[stack.length - 1]).toBe(10);
    });

    test('should swap two simple lists', () => {
      push(vm, 5);
      push(vm, 10);
      push(vm, 20);
      push(vm, Tagged(2, Tag.LIST));
      push(vm, 30);
      push(vm, 40);
      push(vm, Tagged(2, Tag.LIST));
      swapOp(vm);
      const stack = getStackData(vm);
      expect(stack.length).toBe(7);
      expect(stack[0]).toBe(5);
    });

    test('should handle empty lists during swap', () => {
      push(vm, 5);
      push(vm, 42);
      push(vm, Tagged(0, Tag.LIST));
      swapOp(vm);
      const stack = getStackData(vm);
      expect(stack.length).toBe(3);
      expect(stack[0]).toBe(5);
      expect(getTaggedInfo(stack[1])).toMatchObject({ tag: Tag.LIST, value: 0 });
      expect(stack[2]).toBe(42);
    });
  });

  describe('over', () => {
    test('should copy second item to top', () => {
      push(vm, 1);
      push(vm, 2);
      push(vm, 3);
      overOp(vm);
      expect(getStackData(vm)).toEqual([1, 2, 3, 2]);
    });
  });

  describe('rot', () => {
    test('should rotate top three items', () => {
      push(vm, 1);
      push(vm, 2);
      push(vm, 3);
      rotOp(vm);
      expect(getStackData(vm)).toEqual([2, 3, 1]);
    });
  });

  describe('revrot', () => {
    test('should reverse rotate top three items', () => {
      push(vm, 1);
      push(vm, 2);
      push(vm, 3);
      revrotOp(vm);
      expect(getStackData(vm)).toEqual([3, 1, 2]);
    });
  });

  describe('pick', () => {
    test('should copy nth item to top', () => {
      push(vm, 1);
      push(vm, 2);
      push(vm, 3);
      push(vm, 4);
      push(vm, 1); // pick index 1 (second item from top = 3)
      pickOp(vm);
      expect(getStackData(vm)).toEqual([1, 2, 3, 4, 3]);
    });
  });

  describe('tuck', () => {
    test('should copy top item under second', () => {
      push(vm, 1);
      push(vm, 2);
      push(vm, 3);
      tuckOp(vm);
      expect(getStackData(vm)).toEqual([1, 3, 2, 3]);
    });
  });

  describe('nip', () => {
    test('should remove second item', () => {
      push(vm, 1);
      push(vm, 2);
      push(vm, 3);
      nipOp(vm);
      expect(getStackData(vm)).toEqual([1, 3]);
    });
  });

  describe('error cases', () => {
    test('should throw on stack underflow for binary operations', () => {
      const binaryOps = [
        { op: swapOp, name: 'swap' },
        { op: overOp, name: 'over' },
        { op: rotOp, name: 'rot' },
        { op: revrotOp, name: 'revrot' },
        { op: tuckOp, name: 'tuck' },
        { op: nipOp, name: 'nip' },
      ];

      binaryOps.forEach(({ op }) => {
        vm = createVM();
        push(vm, 1);
        expect(() => op(vm)).toThrow('Stack underflow');
      });
    });

    test('should throw on stack underflow for unary operations', () => {
      const unaryOps = [
        { op: dupOp, name: 'dup' },
        { op: dropOp, name: 'drop' },
      ];

      unaryOps.forEach(({ op }) => {
        vm = createVM();
        expect(() => op(vm)).toThrow('Stack underflow');
      });
    });
  });

  describe('stack utilities', () => {
    test('findElement should find elements in sequence', () => {
      pushListLiteral(vm, 1, 2);
      pushNumber(vm, 42);
      pushNumber(vm, 43);

      const [offset1, size1] = findElement(vm, 0);
      expect(offset1).toBe(1);
      expect(size1).toBe(1);

      const [offset2, size2] = findElement(vm, offset1);
      expect(offset2).toBe(2);
      expect(size2).toBe(1);

      const [offset3, size3] = findElement(vm, offset2);
      expect(offset3).toBe(5);
      expect(size3).toBe(3);
    });

    test('cellsRoll should handle empty ranges', () => {
      push(vm, 1);
      push(vm, 2);
      cellsRoll(vm, 0, 0, 1);
      expect(getStackData(vm)).toEqual([1, 2]);
    });
  });
});
