import { Tag, toTaggedValue, fromTaggedValue } from '../../../core/tagged';
import { vm } from '../../../core/globalState';
import { overOp } from '../../../ops/builtins-stack';
import { resetVM } from '../../utils/test-utils';

describe('over Operation', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('simple values', () => {
    test('should duplicate the second item (simple values)', () => {
      vm.push(1);
      vm.push(2);

      overOp(vm);

      expect(vm.getStackData()).toEqual([1, 2, 1]);
    });

    test('should work with multiple values on stack', () => {
      vm.push(10);
      vm.push(20);
      vm.push(30);
      vm.push(40);

      overOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(5);
      expect(stack[0]).toBe(10);
      expect(stack[1]).toBe(20);
      expect(stack[2]).toBe(30);
      expect(stack[3]).toBe(40);
      expect(stack[4]).toBe(30);
    });
  });

  describe('list operations', () => {
    test('should duplicate a list when it is the second item', () => {
      const listTag = toTaggedValue(2, Tag.LIST);
      const linkTag = toTaggedValue(3, Tag.LINK);
      vm.push(listTag);
      vm.push(10);
      vm.push(20);
      vm.push(linkTag);

      vm.push(30);

      overOp(vm);

      const stack = vm.getStackData();

      expect(stack.length).toBeGreaterThan(5);
      expect(stack[4]).toBe(30);
    });

    test('should duplicate a value over a list', () => {
      vm.push(42);

      const listTag = toTaggedValue(2, Tag.LIST);
      const linkTag = toTaggedValue(3, Tag.LINK);
      vm.push(listTag);
      vm.push(10);
      vm.push(20);
      vm.push(linkTag);

      overOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(6);

      expect(stack[0]).toBe(42);

      const remainingListTag = fromTaggedValue(stack[1]);
      expect(remainingListTag.tag).toBe(Tag.LIST);
      expect(stack[2]).toBe(10);
      expect(stack[3]).toBe(20);

      const remainingLinkTag = fromTaggedValue(stack[4]);
      expect(remainingLinkTag.tag).toBe(Tag.LINK);

      expect(stack[5]).toBe(42);
    });

    test('should handle nested lists correctly', () => {
      const innerListTag = toTaggedValue(2, Tag.LIST);
      const outerListTag = toTaggedValue(2, Tag.LIST);
      const outerLinkTag = toTaggedValue(5, Tag.LINK);

      vm.push(outerListTag);
      vm.push(1);
      vm.push(innerListTag);
      vm.push(2);
      vm.push(3);
      vm.push(outerLinkTag);

      vm.push(99);

      overOp(vm);

      const stack = vm.getStackData();

      expect(stack.length).toBeGreaterThan(6);
    });
  });

  describe('error cases', () => {
    test('should throw on insufficient stack', () => {
      vm.push(42);
      expect(() => overOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on empty stack', () => {
      expect(() => overOp(vm)).toThrow('Stack underflow');
    });
  });
});
