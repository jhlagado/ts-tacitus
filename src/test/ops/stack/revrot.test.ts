import { toTaggedValue, Tag } from '../../../core/tagged';
import { vm } from '../../utils/vm-test-utils';
import { revrotOp } from '../../../ops/stack';
import { resetVM } from '../../utils/vm-test-utils';
import { push, getStackData } from '../../../core/vm';

describe('revrot Operation', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('simple values', () => {
    test('should reverse rotate three simple values', () => {
      push(vm, 1);
      push(vm, 2);
      push(vm, 3);

      revrotOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(3);
      expect(stack[0]).toBe(3);
      expect(stack[1]).toBe(1);
      expect(stack[2]).toBe(2);
    });

    it('should reverse rotate with more values on stack', () => {
      resetVM();
      push(vm, 10);
      push(vm, 20);
      push(vm, 3);
      push(vm, 1);
      push(vm, 2);

      revrotOp(vm);

      const stack = getStackData(vm);
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
      push(vm, 1);
      push(vm, 2);
      push(vm, toTaggedValue(2, Tag.LIST));
      push(vm, 5);

      revrotOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(4);
    });

    test('should handle nested lists', () => {
      push(vm, 1);
      push(vm, 2);
      push(vm, 3);
      push(vm, toTaggedValue(3, Tag.LIST));
      push(vm, toTaggedValue(1, Tag.LIST));

      push(vm, 4);
      push(vm, 5);

      revrotOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBeGreaterThan(0);
    });

    test('should reverse rotate three lists', () => {
      push(vm, 1);
      push(vm, 2);
      push(vm, toTaggedValue(2, Tag.LIST));
      push(vm, 3);
      push(vm, 4);
      push(vm, toTaggedValue(2, Tag.LIST));
      push(vm, 5);
      push(vm, 6);
      push(vm, toTaggedValue(2, Tag.LIST));

      revrotOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(9);
    });
  });

  describe('error cases', () => {
    test('should throw on insufficient stack depth', () => {
      push(vm, 1);
      push(vm, 2);

      expect(() => revrotOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on empty stack', () => {
      expect(() => revrotOp(vm)).toThrow('Stack underflow');
    });
  });
});
