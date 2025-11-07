import { Tag, toTaggedValue, fromTaggedValue } from '../../../core/tagged';
import { vm } from '../../../lang/runtime';
import { swapOp } from '../../../ops/stack';
import { resetVM } from '../../utils/vm-test-utils';
import { push, getStackData } from '../../../core/vm';

describe('swap Operation', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('simple values', () => {
    test('should swap two simple values', () => {
      push(vm, 5);
      push(vm, 10);
      push(vm, 20);

      swapOp(vm);

      expect(getStackData(vm)).toEqual([5, 20, 10]);
    });

    test('should swap top two values on deeper stack', () => {
      push(vm, 5);
      push(vm, 1);
      push(vm, 2);
      push(vm, 3);
      push(vm, 4);
      push(vm, 5);
      push(vm, 10);
      push(vm, 20);

      swapOp(vm);

      expect(getStackData(vm)).toEqual([5, 1, 2, 3, 4, 5, 20, 10]);
    });
  });

  describe('list operations (LIST semantics)', () => {
    test('should swap a simple list with a value', () => {
      push(vm, 5);
      push(vm, 20);
      push(vm, 30);
      push(vm, toTaggedValue(2, Tag.LIST));
      push(vm, 10);

      swapOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(5);
    });

    test('should swap a value with a simple list', () => {
      push(vm, 5);
      push(vm, 10);
      push(vm, 20);
      push(vm, 30);
      push(vm, toTaggedValue(2, Tag.LIST));

      swapOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(5);
      expect(stack[0]).toBe(5);
      expect(stack[stack.length - 1]).toBe(10);
    });

    test('should swap two simple lists', () => {
      push(vm, 5);
      push(vm, 10);
      push(vm, 20);
      push(vm, toTaggedValue(2, Tag.LIST));
      push(vm, 30);
      push(vm, 40);
      push(vm, toTaggedValue(2, Tag.LIST));

      swapOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(7);
      expect(stack[0]).toBe(5);
    });

    test('should handle empty lists during swap', () => {
      push(vm, 5);
      push(vm, 42);
      push(vm, toTaggedValue(0, Tag.LIST));

      swapOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(3);
      expect(stack[0]).toBe(5);
      expect(fromTaggedValue(stack[1])).toMatchObject({ tag: Tag.LIST, value: 0 });
      expect(stack[2]).toBe(42);
    });
  });

  describe('error cases', () => {
    test('should throw error when trying to swap with insufficient items', () => {
      push(vm, 42);

      expect(() => {
        swapOp(vm);
      }).toThrow('Stack underflow');
    });

    test('should throw on empty stack', () => {
      expect(() => swapOp(vm)).toThrow('Stack underflow');
    });
  });
});
