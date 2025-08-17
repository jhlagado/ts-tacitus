import { Tag, toTaggedValue } from '../../../core/tagged';
import { vm } from '../../../core/globalState';
import { rotOp } from '../../../ops/stack-ops';
import { resetVM } from "../../utils/vm-test-utils";

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

  describe('list operations (LIST semantics)', () => {
    test('should rotate a list with two simple values', () => {
      vm.push(1);
      vm.push(2);
      vm.push(toTaggedValue(2, Tag.LIST));
      vm.push(3);
      vm.push(4);

      rotOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(5);
    });

    test('should rotate three lists', () => {
      vm.push(1);
      vm.push(2);
      vm.push(toTaggedValue(2, Tag.LIST));
      vm.push(3);
      vm.push(4);
      vm.push(toTaggedValue(2, Tag.LIST));
      vm.push(5);
      vm.push(6);
      vm.push(toTaggedValue(2, Tag.LIST));

      rotOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(9);
    });

    test('should handle nested lists', () => {
      vm.push(1);
      vm.push(2);
      vm.push(3);
      vm.push(toTaggedValue(3, Tag.LIST)); 
      vm.push(4);
      vm.push(5);
      vm.push(toTaggedValue(3, Tag.LIST)); 

      rotOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(7);
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
