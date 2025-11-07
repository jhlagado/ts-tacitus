import { toTaggedValue, Tag } from '../../../core/tagged';
import { vm } from '../../../lang/runtime';
import { overOp } from '../../../ops/stack';
import { resetVM } from '../../utils/vm-test-utils';
import { push, getStackData } from '../../../core/vm';

describe('over Operation', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('simple values', () => {
    test('should duplicate the second item (simple values)', () => {
      push(vm, 1);
      push(vm, 2);

      overOp(vm);

      expect(getStackData(vm)).toEqual([1, 2, 1]);
    });

    test('should work with multiple values on stack', () => {
      push(vm, 10);
      push(vm, 20);
      push(vm, 30);
      push(vm, 40);

      overOp(vm);

      const stack = getStackData(vm);
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
      push(vm, 42);
      push(vm, 10);
      push(vm, 20);
      push(vm, toTaggedValue(2, Tag.LIST));

      overOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(5);
      expect(stack[0]).toBe(42);
      expect(stack[stack.length - 1]).toBe(42);
    });

    test('should handle nested lists correctly', () => {
      push(vm, 2);
      push(vm, 3);
      push(vm, toTaggedValue(2, Tag.LIST));
      push(vm, 1);
      push(vm, toTaggedValue(2, Tag.LIST));

      push(vm, 99);

      overOp(vm);

      const stack = getStackData(vm);

      expect(stack.length).toBeGreaterThan(4);
    });
  });

  describe('error cases', () => {
    test('should throw on insufficient stack', () => {
      push(vm, 42);
      expect(() => overOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on empty stack', () => {
      expect(() => overOp(vm)).toThrow('Stack underflow');
    });
  });
});
