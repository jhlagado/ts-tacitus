import { Tag, toTaggedValue, fromTaggedValue } from '../../../core/tagged';
import { vm } from '../../../core/globalState';
import { swapOp } from '../../../ops/builtins-stack';
import { resetVM } from '../../utils/test-utils';

describe('swap Operation', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('simple values', () => {
    test('should swap two simple values', () => {
      vm.push(5);
      vm.push(10);
      vm.push(20);

      swapOp(vm);

      expect(vm.getStackData()).toEqual([5, 20, 10]);
    });

    test('should swap top two values on deeper stack', () => {
      vm.push(5);
      vm.push(1);
      vm.push(2);
      vm.push(3);
      vm.push(4);
      vm.push(5);
      vm.push(10);
      vm.push(20);

      swapOp(vm);

      expect(vm.getStackData()).toEqual([5, 1, 2, 3, 4, 5, 20, 10]);
    });
  });

  describe('list operations', () => {
    test('should swap a simple list with a value', () => {
      vm.push(5);

      const listTag = toTaggedValue(2, Tag.LIST);
      const linkTag = toTaggedValue(3, Tag.LINK);
      vm.push(listTag);
      vm.push(20);
      vm.push(30);
      vm.push(linkTag);

      vm.push(10);

      swapOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(6);
    });

    test('should swap a value with a simple list', () => {
      vm.push(5);
      vm.push(10);

      const listTag = toTaggedValue(2, Tag.LIST);
      const linkTag = toTaggedValue(3, Tag.LINK);
      vm.push(listTag);
      vm.push(20);
      vm.push(30);
      vm.push(linkTag);

      swapOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(6);
      expect(stack[0]).toBe(5);

      const swappedListTag = fromTaggedValue(stack[1]);
      expect(swappedListTag.tag).toBe(Tag.LIST);
      expect(swappedListTag.value).toBe(2);
      expect(stack[2]).toBe(20);
      expect(stack[3]).toBe(30);

      const swappedLinkTag = fromTaggedValue(stack[4]);
      expect(swappedLinkTag.tag).toBe(Tag.LINK);
      expect(swappedLinkTag.value).toBe(3);

      expect(stack[5]).toBe(10);
    });

    test('should swap two simple lists', () => {
      vm.push(5);

      const listTag1 = toTaggedValue(2, Tag.LIST);
      const linkTag1 = toTaggedValue(3, Tag.LINK);
      vm.push(listTag1);
      vm.push(10);
      vm.push(20);
      vm.push(linkTag1);

      const listTag2 = toTaggedValue(2, Tag.LIST);
      const linkTag2 = toTaggedValue(3, Tag.LINK);
      vm.push(listTag2);
      vm.push(30);
      vm.push(40);
      vm.push(linkTag2);

      swapOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(9);
      expect(stack[0]).toBe(5);

      const swappedListTag2 = fromTaggedValue(stack[1]);
      expect(swappedListTag2.tag).toBe(Tag.LIST);
      expect(swappedListTag2.value).toBe(2);
      expect(stack[2]).toBe(30);
      expect(stack[3]).toBe(40);

      const swappedLinkTag2 = fromTaggedValue(stack[4]);
      expect(swappedLinkTag2.tag).toBe(Tag.LINK);
      expect(swappedLinkTag2.value).toBe(3);

      const swappedListTag1 = fromTaggedValue(stack[5]);
      expect(swappedListTag1.tag).toBe(Tag.LIST);
      expect(swappedListTag1.value).toBe(2);
      expect(stack[6]).toBe(10);
      expect(stack[7]).toBe(20);

      const swappedLinkTag1 = fromTaggedValue(stack[8]);
      expect(swappedLinkTag1.tag).toBe(Tag.LINK);
      expect(swappedLinkTag1.value).toBe(3);
    });

    test('should handle empty lists during swap', () => {
      vm.push(5);
      vm.push(42);

      const listTag = toTaggedValue(0, Tag.LIST);
      const linkTag = toTaggedValue(1, Tag.LINK);
      vm.push(listTag);
      vm.push(linkTag);

      swapOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(4);
      expect(stack[0]).toBe(5);

      const swappedListTag = fromTaggedValue(stack[1]);
      expect(swappedListTag.tag).toBe(Tag.LIST);
      expect(swappedListTag.value).toBe(0);

      const swappedLinkTag = fromTaggedValue(stack[2]);
      expect(swappedLinkTag.tag).toBe(Tag.LINK);
      expect(swappedLinkTag.value).toBe(1);

      expect(stack[3]).toBe(42);
    });
  });

  describe('error cases', () => {
    test('should throw error when trying to swap with insufficient items', () => {
      vm.push(42);

      expect(() => {
        swapOp(vm);
      }).toThrow('Stack underflow');
    });

    test('should throw on empty stack', () => {
      expect(() => swapOp(vm)).toThrow('Stack underflow');
    });
  });
});
