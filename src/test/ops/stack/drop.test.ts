import { Tag, toTaggedValue } from '../../../core/tagged';
import { vm } from '../../../lang/runtime';
import { dropOp } from '../../../ops/stack';
import { resetVM } from '../../utils/vm-test-utils';

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

  describe('list operations (LIST semantics)', () => {
    test('should drop an entire simple list', () => {
      vm.push(10);
      vm.push(20);
      vm.push(toTaggedValue(2, Tag.LIST));
      dropOp(vm);
      expect(vm.getStackData()).toEqual([]);
    });

    test('should drop a list while leaving other values on stack', () => {
      vm.push(5);
      vm.push(1);
      vm.push(2);
      vm.push(toTaggedValue(2, Tag.LIST));
      dropOp(vm);
      const stack = vm.getStackData();
      expect(stack).toEqual([5]);
    });

    test('should drop multiple lists consecutively', () => {
      vm.push(10);
      vm.push(20);
      vm.push(toTaggedValue(2, Tag.LIST));
      vm.push(30);
      vm.push(40);
      vm.push(toTaggedValue(2, Tag.LIST));

      dropOp(vm);
      let stack = vm.getStackData();
      expect(stack.length).toBe(3);

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
