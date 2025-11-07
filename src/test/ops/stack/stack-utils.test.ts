import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM, createVM } from '../../../core/vm';
import { toTaggedValue, Tag } from '../../../core/tagged';
import { cellsRoll, findElement } from '../../../ops/stack';
import { push, getStackData } from '../../../core/vm';

describe('Stack Utils', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('rangeRoll', () => {
    test('should handle empty ranges', () => {
      push(vm, 1);
      push(vm, 2);
      cellsRoll(vm, 0, 0, 1);
      expect(getStackData(vm)).toEqual([1, 2]);
    });

    test('should handle zero shift amount', () => {});
  });

  describe('findElement', () => {
    test('should return size 1 when stack is empty', () => {
      const [nextSlot, size] = findElement(vm, 0);
      expect(size).toBe(1);
      expect(nextSlot).toBe(1);
    });
  });

  describe('findElement', () => {
    function pushValue(value: number, tag: Tag = Tag.NUMBER): void {
      push(vm, toTaggedValue(value, tag));
    }

    function createList(...values: number[]): void {
      values.forEach(val => pushValue(val));
      pushValue(values.length, Tag.LIST);
    }

    beforeEach(() => {
      vm = createVM();
    });

    test('should find elements in sequence', () => {
      createList(1, 2);
      pushValue(42);
      pushValue(43);

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

    test('should handle list at TOS', () => {
      createList(1, 2);

      const [nextSlot, size] = findElement(vm, 0);
      expect(size).toBe(3);
      expect(nextSlot).toBe(3);
    });

    test('should handle multiple lists', () => {
      createList(3, 4);
      createList(1);

      const [offset1, size1] = findElement(vm, 0);
      expect(size1).toBe(2);

      const [_offset2, size2] = findElement(vm, offset1);
      expect(size2).toBe(3);
    });
  });
});
