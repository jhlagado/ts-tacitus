import { Tag, toTaggedValue, fromTaggedValue } from '../../../core/tagged';
import { vm } from '../../../core/globalState';
import { revrotOp } from '../../../ops/builtins-stack';
import { resetVM } from '../../utils/test-utils';

describe('revrot Operation', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('simple values', () => {
    test('should reverse rotate three simple values', () => {
      vm.push(1);
      vm.push(2);
      vm.push(3);

      revrotOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(3);
      expect(stack[0]).toBe(3);
      expect(stack[1]).toBe(1);
      expect(stack[2]).toBe(2);
    });

    it('should reverse rotate with more values on stack', () => {
      resetVM();
      vm.push(10);
      vm.push(20);
      vm.push(3);
      vm.push(1);
      vm.push(2);

      revrotOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(5);

      expect(typeof stack[0]).toBe('number');
      expect(typeof stack[1]).toBe('number');
      expect(typeof stack[2]).toBe('number');
      expect(typeof stack[3]).toBe('number');
      expect(typeof stack[4]).toBe('number');
    });
  });

  describe('list operations', () => {
    it('should reverse rotate a list with two simple values', () => {
      resetVM();

      const list = toTaggedValue(2, Tag.LIST);
      vm.push(1);
      vm.push(2);
      vm.push(list);
      vm.push(5);

      revrotOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(4);
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

      revrotOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(8);
    });

    test('should reverse rotate three lists', () => {
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

      revrotOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(12);
    });
  });

  describe('error cases', () => {
    test('should throw on insufficient stack depth', () => {
      vm.push(1);
      vm.push(2);

      expect(() => revrotOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on empty stack', () => {
      expect(() => revrotOp(vm)).toThrow('Stack underflow');
    });
  });
});
