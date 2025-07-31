import { Tag, toTaggedValue, fromTaggedValue } from '../../../core/tagged';
import { vm } from '../../../core/globalState';
import { dropOp } from '../../../ops/builtins-stack';
import { resetVM } from '../../utils/test-utils';

describe('drop Operation', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('simple values', () => {
    test('should drop a regular value from the stack', () => {
      vm.push(1);
      vm.push(2);
      
      dropOp(vm);
      
      const stack = vm.getStackData();
      expect(stack.length).toBe(1);
      expect(stack[0]).toBe(1);
    });

    test('should drop the top value leaving others intact', () => {
      vm.push(10);
      vm.push(20);
      vm.push(30);
      
      dropOp(vm);
      
      const stack = vm.getStackData();
      expect(stack.length).toBe(2);
      expect(stack[0]).toBe(10);
      expect(stack[1]).toBe(20);
    });
  });

  describe('list operations', () => {
    test('should drop an entire simple list', () => {
      const listTag = toTaggedValue(2, Tag.LIST);
      const linkTag = toTaggedValue(3, Tag.LINK);

      vm.push(listTag);
      vm.push(10);
      vm.push(20);
      vm.push(linkTag);
      
      dropOp(vm);
      
      const stack = vm.getStackData();
      expect(stack.length).toBe(0);
    });

    test('should drop a list while leaving other values on stack', () => {
      // Push base value
      vm.push(5);
      
      // Push list
      const listTag = toTaggedValue(2, Tag.LIST);
      const linkTag = toTaggedValue(3, Tag.LINK);
      vm.push(listTag);
      vm.push(1);
      vm.push(2);
      vm.push(linkTag);
      
      dropOp(vm);
      
      const stack = vm.getStackData();
      expect(stack.length).toBe(1);
      expect(stack[0]).toBe(5);
    });

    test('should drop a nested list completely', () => {
      // Create nested list: (1 (2 3) 4)
      const innerListTag = toTaggedValue(2, Tag.LIST);
      const outerListTag = toTaggedValue(3, Tag.LIST);
      const outerLinkTag = toTaggedValue(6, Tag.LINK);

      vm.push(outerListTag);
      vm.push(1);
      vm.push(innerListTag);
      vm.push(2);
      vm.push(3);
      vm.push(4);
      vm.push(outerLinkTag);

      const stackBeforeLength = vm.getStackData().length;
      expect(stackBeforeLength).toBeGreaterThan(0);
      
      dropOp(vm);
      
      const stackAfter = vm.getStackData();
      expect(stackAfter.length).toBe(0);
    });

    test('should drop only the top list when multiple lists are present', () => {
      // First list: (1 2)
      const listTag1 = toTaggedValue(2, Tag.LIST);
      const linkTag1 = toTaggedValue(3, Tag.LINK);
      vm.push(listTag1);
      vm.push(1);
      vm.push(2);
      vm.push(linkTag1);

      // Second list: (3 4)
      const listTag2 = toTaggedValue(2, Tag.LIST);
      const linkTag2 = toTaggedValue(3, Tag.LINK);
      vm.push(listTag2);
      vm.push(3);
      vm.push(4);
      vm.push(linkTag2);

      const stackBeforeLength = vm.getStackData().length;
      expect(stackBeforeLength).toBe(8);
      
      dropOp(vm);
      
      const stackAfter = vm.getStackData();
      expect(stackAfter.length).toBe(4);
      
      // Verify first list remains
      const { tag: listTag } = fromTaggedValue(stackAfter[0]);
      expect(listTag).toBe(Tag.LIST);
      expect(stackAfter[1]).toBe(1);
      expect(stackAfter[2]).toBe(2);
    });

    test('should handle complex scenarios with multiple list operations', () => {
      // Create nested list: (1 (2 3))
      const innerListTag = toTaggedValue(2, Tag.LIST);
      const outerListTag = toTaggedValue(2, Tag.LIST);
      const outerLinkTag = toTaggedValue(5, Tag.LINK);

      vm.push(outerListTag);
      vm.push(1);
      vm.push(innerListTag);
      vm.push(2);
      vm.push(3);
      vm.push(outerLinkTag);

      const stackBeforeLength = vm.getStackData().length;
      
      dropOp(vm);
      
      const stackAfter = vm.getStackData();
      expect(stackAfter.length).toBe(0);
      expect(stackAfter.length).toBeLessThan(stackBeforeLength);
    });

    test('should drop multiple lists consecutively', () => {
      // First list: (10 20)
      const listTag1 = toTaggedValue(2, Tag.LIST);
      const linkTag1 = toTaggedValue(3, Tag.LINK);
      vm.push(listTag1);
      vm.push(10);
      vm.push(20);
      vm.push(linkTag1);

      // Second list: (30 40)
      const listTag2 = toTaggedValue(2, Tag.LIST);
      const linkTag2 = toTaggedValue(3, Tag.LINK);
      vm.push(listTag2);
      vm.push(30);
      vm.push(40);
      vm.push(linkTag2);

      // Drop first list (top)
      dropOp(vm);
      let stack = vm.getStackData();
      expect(stack.length).toBe(4);

      // Drop second list
      dropOp(vm);
      stack = vm.getStackData();
      expect(stack.length).toBe(0);
    });
  });

  describe('error cases', () => {
    test('should throw on empty stack', () => {
      expect(() => dropOp(vm)).toThrow('Stack underflow');
    });
  });
});
