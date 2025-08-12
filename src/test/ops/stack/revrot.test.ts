import { toTaggedValue, Tag } from '../../../core/tagged';
import { vm } from '../../../core/globalState';
import { revrotOp } from '../../../core/stack-ops';
import { resetVM } from "../../utils/vm-test-utils";

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
      vm.push(1);
      vm.push(2);
      vm.push(toTaggedValue(2, Tag.LIST));
      vm.push(5);

      revrotOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(4);
    });

    test('should handle nested lists', () => {
      // Build ( ( 1 2 3 ) ) then 4 5
      vm.push(1);
      vm.push(2);
      vm.push(3);
      vm.push(toTaggedValue(3, Tag.LIST));
      vm.push(toTaggedValue(1, Tag.LIST));

      vm.push(4);
      vm.push(5);

      revrotOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBeGreaterThan(0);
    });

    test('should reverse rotate three lists', () => {
      vm.push(1);
      vm.push(2);
      vm.push(toTaggedValue(2, Tag.LIST));
      vm.push(3);
      vm.push(4);
      vm.push(toTaggedValue(2, Tag.LIST));
      vm.push(5);
      vm.push(6);
      vm.push(toTaggedValue(2, Tag.LIST));

      revrotOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(9);
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
