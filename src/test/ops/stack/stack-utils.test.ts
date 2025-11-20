import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM, createVM } from '../../../core/vm';
import { Tagged, Tag } from '../../../core/tagged';
import { cellsRoll, findElement, cellsCopy, cellsReverse } from '../../../ops/stack';
import { push, getStackData, depth } from '../../../core/vm';
import { pushListLiteral, pushNumber } from '../../utils/vm-test-utils';

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

    test('should handle zero shift amount', () => {
      push(vm, 1);
      push(vm, 2);
      push(vm, 3);
      const initialStack = getStackData(vm);
      cellsRoll(vm, 0, 3, 0);
      expect(getStackData(vm)).toEqual(initialStack);
    });
  });

  describe('cellsCopy', () => {
    test('should handle zero slot count (no-op)', () => {
      push(vm, 1);
      push(vm, 2);
      const initialStack = getStackData(vm);
      cellsCopy(vm, 0, 0);
      expect(getStackData(vm)).toEqual(initialStack);
    });

    test('should handle negative slot count (no-op)', () => {
      push(vm, 1);
      push(vm, 2);
      const initialStack = getStackData(vm);
      cellsCopy(vm, 0, -1);
      expect(getStackData(vm)).toEqual(initialStack);
    });

    test('should copy single element', () => {
      push(vm, 42);
      const stackDepth = depth(vm);
      cellsCopy(vm, 0, 1);
      expect(depth(vm)).toBe(stackDepth + 1);
      expect(getStackData(vm)[0]).toBe(getStackData(vm)[1]);
    });

    test('should copy multiple elements', () => {
      push(vm, 1);
      push(vm, 2);
      push(vm, 3);
      const stackDepth = depth(vm);
      cellsCopy(vm, 0, 3);
      expect(depth(vm)).toBe(stackDepth + 3);
    });
  });

  describe('cellsReverse', () => {
    test('should handle zero slot count (no-op)', () => {
      push(vm, 1);
      push(vm, 2);
      const initialStack = getStackData(vm);
      cellsReverse(vm, 0, 0);
      expect(getStackData(vm)).toEqual(initialStack);
    });

    test('should handle single slot (no-op)', () => {
      push(vm, 42);
      const initialStack = getStackData(vm);
      cellsReverse(vm, 0, 1);
      expect(getStackData(vm)).toEqual(initialStack);
    });
  });

  describe('findElement', () => {
    test('should return size 1 when stack is empty', () => {
      const [nextSlot, size] = findElement(vm, 0);
      expect(size).toBe(1);
      expect(nextSlot).toBe(1);
    });
  });

  describe('findElement', () => {
    beforeEach(() => {
      vm = createVM();
    });

    test('should find elements in sequence', () => {
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

    test('should handle list at TOS', () => {
      pushListLiteral(vm, 1, 2);

      const [nextSlot, size] = findElement(vm, 0);
      expect(size).toBe(3);
      expect(nextSlot).toBe(3);
    });

    test('should handle multiple lists', () => {
      pushListLiteral(vm, 3, 4);
      pushListLiteral(vm, 1);

      const [offset1, size1] = findElement(vm, 0);
      expect(size1).toBe(2);

      const [_offset2, size2] = findElement(vm, offset1);
      expect(size2).toBe(3);
    });
  });
});
