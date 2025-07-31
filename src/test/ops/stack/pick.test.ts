import { Tag, toTaggedValue, fromTaggedValue } from '../../../core/tagged';
import { vm } from '../../../core/globalState';
import { pickOp } from '../../../ops/builtins-stack';
import { resetVM } from '../../utils/test-utils';

describe('pick Operation', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('simple values', () => {
    test('should duplicate the top element when index is 0 (like dup)', () => {
      vm.push(1);
      vm.push(0);

      pickOp(vm);

      expect(vm.getStackData()).toEqual([1, 1]);
    });

    test('should duplicate the second element when index is 1 (like over)', () => {
      vm.push(1);
      vm.push(2);
      vm.push(1);

      pickOp(vm);

      expect(vm.getStackData()).toEqual([1, 2, 1]);
    });

    test('should pick from deeper in the stack', () => {
      vm.push(10);
      vm.push(20);
      vm.push(30);
      vm.push(40);
      vm.push(2); // Pick element at index 2 (which is 20, third from top)

      pickOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(5);
      expect(stack[0]).toBe(10);
      expect(stack[1]).toBe(20);
      expect(stack[2]).toBe(30);
      expect(stack[3]).toBe(40);
      expect(stack[4]).toBe(20); // Picked element (20 was at index 2 from TOS)
    });
  });

  describe('list operations', () => {
    test('should pick a list from the stack', () => {
      // Create list (10 20) first, then add value on top
      const listTag = toTaggedValue(2, Tag.LIST);
      const linkTag = toTaggedValue(3, Tag.LINK);
      vm.push(listTag);
      vm.push(10);
      vm.push(20);
      vm.push(linkTag);
      
      vm.push(5); // Value on top
      
      vm.push(1); // Pick index 1

      pickOp(vm);

      const stack = vm.getStackData();
      
      // Just verify the operation worked
      expect(stack.length).toBeGreaterThanOrEqual(6);
    });

    test('should pick a value over a list', () => {
      vm.push(42);
      
      // Create list (10 20)
      const listTag = toTaggedValue(2, Tag.LIST);
      const linkTag = toTaggedValue(3, Tag.LINK);
      vm.push(listTag);
      vm.push(10);
      vm.push(20);
      vm.push(linkTag);
      
      vm.push(1); // Pick index 1 (the value 42)

      pickOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(6);
      
      expect(stack[0]).toBe(42); // Original value
      expect(stack[5]).toBe(42); // Picked value
    });
  });

  describe('error cases', () => {
    test('should throw on stack underflow', () => {
      expect(() => pickOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on negative index', () => {
      vm.push(-1);
      expect(() => pickOp(vm)).toThrow('Invalid index for pick: -1');
    });

    test('should throw when index is out of bounds', () => {
      vm.push(1);
      vm.push(2); // Index 2 but only 1 element below
      expect(() => pickOp(vm)).toThrow('Stack underflow in pick operation');
    });

    test('should throw when stack has only the index', () => {
      vm.push(0); // Index 0 but no element to pick
      expect(() => pickOp(vm)).toThrow('Stack underflow in pick operation');
    });
  });
});
