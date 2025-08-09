import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from '../../../core/vm';
import { SEG_STACK } from '../../../core/constants';
import { toTaggedValue, Tag } from '../../../core/tagged';
import { slotsRoll } from '../../../stack/slots';
import { findElement } from '../../../stack/find';

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

    function createRList(...values: number[]): void {
      // LIST layout: [payload...] [LIST:slotCount] with header at TOS
      values.forEach(val => pushValue(val));
      pushValue(values.length, Tag.LIST);
    }

    beforeEach(() => {
      vm = new VM();
    });

    test('should find elements in sequence', () => {
      createRList(1, 2);
      pushValue(42);
      pushValue(43);

      const [offset1, size1] = findElement(vm, 0);
      expect(offset1).toBe(1);
      expect(size1).toBe(1);

      const [offset2, size2] = findElement(vm, offset1);
      expect(offset2).toBe(2);
      expect(size2).toBe(1);

      const [offset3, size3] = findElement(vm, offset2);
      expect(offset3).toBe(5); // LIST size is header+payload = 3
      expect(size3).toBe(3);
    });

    test('should handle list at TOS', () => {
      createRList(1, 2);

      const [nextSlot, size] = findElement(vm, 0);
      expect(size).toBe(3);
      expect(nextSlot).toBe(3);
    });

    test('should handle multiple lists', () => {
      createRList(3, 4);
      createRList(1);

      const [offset1, size1] = findElement(vm, 0);
      expect(size1).toBe(2); // (1) -> payload(1)+header(1)

      const [_offset2, size2] = findElement(vm, offset1);
      expect(size2).toBe(3); // (3,4) -> payload(2)+header(1)
    });
  });
});
