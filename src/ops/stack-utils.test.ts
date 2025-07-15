import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from '../core/vm';
import { SEG_STACK } from '../core/constants';
import { toTaggedValue, Tag } from '../core/tagged';
import { slotsRoll } from '../stack/slots';
import { findElement } from '../stack/find';

const BYTES_PER_ELEMENT = 4;

describe('Stack Utils', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  describe('rangeRoll', () => {
    test('should handle empty ranges', () => {
      vm.push(1);
      vm.push(2);
      slotsRoll(vm, 0, 0, 1);
      expect(vm.getStackData()).toEqual([1, 2]);
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
      vm.memory.writeFloat32(SEG_STACK, vm.SP, toTaggedValue(value, tag));
      vm.SP += BYTES_PER_ELEMENT;
    }

    function createSimpleList(...values: number[]): void {
      pushValue(values.length, Tag.LIST);

      values.forEach(val => pushValue(val));

      pushValue(values.length + 1, Tag.LINK);
    }

    beforeEach(() => {
      vm = new VM();
    });

    test('should find elements in sequence', () => {
      createSimpleList(1, 2);
      pushValue(42);
      pushValue(43);

      const [offset1, size1] = findElement(vm, 0);
      expect(offset1).toBe(1);
      expect(size1).toBe(1);

      const [offset2, size2] = findElement(vm, offset1);
      expect(offset2).toBe(2);
      expect(size2).toBe(1);

      const [offset3, size3] = findElement(vm, offset2);
      expect(offset3).toBe(6);
      expect(size3).toBe(4);
    });

    test('should handle list at TOS', () => {
      createSimpleList(1, 2);

      const [nextSlot, size] = findElement(vm, 0);
      expect(size).toBe(4);
      expect(nextSlot).toBe(4);
    });

    test('should handle multiple lists', () => {
      createSimpleList(3, 4);
      createSimpleList(1);

      const [offset1, size1] = findElement(vm, 0);
      expect(size1).toBe(3);

      const [_offset2, size2] = findElement(vm, offset1);
      expect(size2).toBe(4);
    });
  });
});
