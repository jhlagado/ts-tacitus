import { Tag, toTaggedValue, fromTaggedValue } from '../../../core/tagged';
import { vm } from '../../../core/globalState';
import { swapOp } from '../../../ops/stack-ops';
import { resetVM } from "../../utils/vm-test-utils";

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

  describe('list operations (LIST semantics)', () => {
    test('should swap a simple list with a value', () => {
      vm.push(5);
      vm.push(20);
      vm.push(30);
      vm.push(toTaggedValue(2, Tag.LIST));
      vm.push(10);

      swapOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(5);
    });

    test('should swap a value with a simple list', () => {
      vm.push(5);
      vm.push(10);
      vm.push(20);
      vm.push(30);
      vm.push(toTaggedValue(2, Tag.LIST));

      swapOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(5);
      expect(stack[0]).toBe(5);
      expect(stack[stack.length - 1]).toBe(10);
    });

    test('should swap two simple lists', () => {
      vm.push(5);
      vm.push(10);
      vm.push(20);
      vm.push(toTaggedValue(2, Tag.LIST));
      vm.push(30);
      vm.push(40);
      vm.push(toTaggedValue(2, Tag.LIST));

      swapOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(7);
      expect(stack[0]).toBe(5);
    });

    test('should handle empty lists during swap', () => {
      vm.push(5);
      vm.push(42);
      vm.push(toTaggedValue(0, Tag.LIST));

      swapOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(3);
      expect(stack[0]).toBe(5);
      expect(fromTaggedValue(stack[1])).toMatchObject({ tag: Tag.LIST, value: 0 });
      expect(stack[2]).toBe(42);
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
