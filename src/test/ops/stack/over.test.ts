import { toTaggedValue, Tag } from '../../../core/tagged';
import { vm } from '../../../core/globalState';
import { overOp } from '../../../core/stack-ops';
import { resetVM } from "../../utils/vm-test-utils";

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

  describe('list operations (LIST semantics)', () => {
    test('should duplicate a value over a list', () => {
      vm.push(42);
      vm.push(10);
      vm.push(20);
      vm.push(toTaggedValue(2, Tag.LIST));

      overOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(5);
      expect(stack[0]).toBe(42);
      expect(stack[stack.length - 1]).toBe(42);
    });

    test('should handle nested lists correctly', () => {
      // Build outer ( 1 ( 2 3 ) ) as LIST
      vm.push(2);
      vm.push(3);
      vm.push(toTaggedValue(2, Tag.LIST)); // inner
      vm.push(1);
      vm.push(toTaggedValue(2, Tag.LIST)); // outer

      vm.push(99);

      overOp(vm);

      const stack = vm.getStackData();

      expect(stack.length).toBeGreaterThan(4);
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
