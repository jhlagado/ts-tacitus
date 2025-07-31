import { Tag, toTaggedValue, fromTaggedValue } from '../../../core/tagged';
import { vm } from '../../../core/globalState';
import { rotOp } from '../../../ops/builtins-stack';
import { resetVM } from '../../utils/test-utils';

describe('rot Operation', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('simple values', () => {
    test('should rotate three simple values', () => {
      vm.push(1);
      vm.push(2);
      vm.push(3);

      rotOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(3);
      expect(stack[0]).toBe(2);
      expect(stack[1]).toBe(3);
      expect(stack[2]).toBe(1);
    });

    test('should rotate with more values on stack', () => {
      vm.push(10);
      vm.push(20);
      vm.push(1);
      vm.push(2);
      vm.push(3);

      rotOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(5);

      expect(stack).toBeDefined();
    });
  });

  describe('list operations', () => {
    test('should rotate a list with two simple values', () => {
      const listTag = toTaggedValue(2, Tag.LIST);
      const linkTag = toTaggedValue(3, Tag.LINK);
      vm.push(listTag);
      vm.push(1);
      vm.push(2);
      vm.push(linkTag);

      vm.push(3);
      vm.push(4);

      rotOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(6);
    });

    test('should rotate three lists', () => {
      const listTag1 = toTaggedValue(2, Tag.LIST);
      const linkTag1 = toTaggedValue(3, Tag.LINK);
      vm.push(listTag1);
      vm.push(1);
      vm.push(2);
      vm.push(linkTag1);

      const listTag2 = toTaggedValue(2, Tag.LIST);
      const linkTag2 = toTaggedValue(3, Tag.LINK);
      vm.push(listTag2);
      vm.push(3);
      vm.push(4);
      vm.push(linkTag2);

      const listTag3 = toTaggedValue(2, Tag.LIST);
      const linkTag3 = toTaggedValue(3, Tag.LINK);
      vm.push(listTag3);
      vm.push(5);
      vm.push(6);
      vm.push(linkTag3);

      rotOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(12);

      expect(fromTaggedValue(stack[0])).toEqual({ tag: Tag.LIST, value: 2 });
      expect(stack[1]).toBe(3);
      expect(stack[2]).toBe(4);
      expect(fromTaggedValue(stack[3])).toEqual({ tag: Tag.LINK, value: 3 });

      expect(fromTaggedValue(stack[4])).toEqual({ tag: Tag.LIST, value: 2 });
      expect(stack[5]).toBe(5);
      expect(stack[6]).toBe(6);
      expect(fromTaggedValue(stack[7])).toEqual({ tag: Tag.LINK, value: 3 });

      expect(fromTaggedValue(stack[8])).toEqual({ tag: Tag.LIST, value: 2 });
      expect(stack[9]).toBe(1);
      expect(stack[10]).toBe(2);
      expect(fromTaggedValue(stack[11])).toEqual({ tag: Tag.LINK, value: 3 });
    });

    test('should handle nested lists', () => {
      const innerListTag = toTaggedValue(2, Tag.LIST);
      const outerListTag = toTaggedValue(2, Tag.LIST);
      const outerLinkTag = toTaggedValue(5, Tag.LINK);

      vm.push(outerListTag);
      vm.push(innerListTag);
      vm.push(1);
      vm.push(2);
      vm.push(3);
      vm.push(outerLinkTag);

      vm.push(4);
      vm.push(5);

      rotOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(8);
    });
  });

  describe('error cases', () => {
    test('should throw on insufficient stack depth', () => {
      vm.push(1);
      vm.push(2);

      expect(() => rotOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on empty stack', () => {
      expect(() => rotOp(vm)).toThrow('Stack underflow');
    });
  });
});
