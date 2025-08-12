import { Tag, toTaggedValue } from '../../../core/tagged';
import { vm } from '../../../core/globalState';
import { dupOp } from '../../../ops/stack-ops';
import { resetVM } from "../../utils/vm-test-utils";

describe('dup Operation', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('simple values', () => {
    test('should duplicate a simple value', () => {
      vm.push(5);
      dupOp(vm);
      expect(vm.getStackData()).toEqual([5, 5]);
    });

    test('should duplicate a regular value', () => {
      vm.push(42);
      dupOp(vm);
      expect(vm.getStackData()).toEqual([42, 42]);
    });
  });

  describe('list operations (LIST semantics)', () => {
    test('should duplicate a list', () => {
      vm.push(10);
      vm.push(20);
      vm.push(30);
      vm.push(toTaggedValue(3, Tag.LIST));

      dupOp(vm);

      const stack = vm.getStackData();
      // Expect two copies of payload and two headers
      expect(stack.slice(-8)).toEqual([
        10,
        20,
        30,
        toTaggedValue(3, Tag.LIST),
        10,
        20,
        30,
        toTaggedValue(3, Tag.LIST),
      ]);
    });

    test('should duplicate a simple list', () => {
      vm.push(1);
      vm.push(2);
      vm.push(toTaggedValue(2, Tag.LIST));

      dupOp(vm);

      const stack = vm.getStackData();
      expect(stack.slice(-6)).toEqual([
        1,
        2,
        toTaggedValue(2, Tag.LIST),
        1,
        2,
        toTaggedValue(2, Tag.LIST),
      ]);
    });

    test('should duplicate a larger list', () => {
      vm.push(10);
      vm.push(20);
      vm.push(30);
      vm.push(toTaggedValue(3, Tag.LIST));

      dupOp(vm);

      const stack = vm.getStackData();
      expect(stack.slice(-8)).toEqual([
        10,
        20,
        30,
        toTaggedValue(3, Tag.LIST),
        10,
        20,
        30,
        toTaggedValue(3, Tag.LIST),
      ]);
    });

    test('should duplicate a nested list', () => {
      // Build ( 1 ( 2 3 ) 4 )
      vm.push(2);
      vm.push(3);
      vm.push(toTaggedValue(2, Tag.LIST));
      vm.push(1);
      vm.push(4);
      vm.push(toTaggedValue(3, Tag.LIST));

      const before = vm.getStackData().length;
      dupOp(vm);
      const after = vm.getStackData().length;
      expect(after).toBeGreaterThan(before);
    });
  });

  describe('error cases', () => {
    test('should throw on empty stack', () => {
      expect(() => dupOp(vm)).toThrow(
        `Stack underflow: 'dup' requires 1 operand (stack: ${JSON.stringify(vm.getStackData())})`,
      );
    });
  });
});
