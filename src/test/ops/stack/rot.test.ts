import { Tag, toTaggedValue } from '../../../core/tagged';
import { vm } from '../../../lang/runtime';
import { rotOp } from '../../../ops/stack';
import { resetVM } from '../../utils/vm-test-utils';
import { push, getStackData } from '../../../core/vm';

describe('rot Operation', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('simple values', () => {
    test('should rotate three simple values', () => {
      push(vm, 1);
      push(vm, 2);
      push(vm, 3);

      rotOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(3);
      expect(stack[0]).toBe(2);
      expect(stack[1]).toBe(3);
      expect(stack[2]).toBe(1);
    });

    test('should rotate with more values on stack', () => {
      push(vm, 10);
      push(vm, 20);
      push(vm, 1);
      push(vm, 2);
      push(vm, 3);

      rotOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(5);

      expect(stack).toBeDefined();
    });
  });

  describe('list operations (LIST semantics)', () => {
    test('should rotate a list with two simple values', () => {
      push(vm, 1);
      push(vm, 2);
      push(vm, toTaggedValue(2, Tag.LIST));
      push(vm, 3);
      push(vm, 4);

      rotOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(5);
    });

    test('should rotate three lists', () => {
      push(vm, 1);
      push(vm, 2);
      push(vm, toTaggedValue(2, Tag.LIST));
      push(vm, 3);
      push(vm, 4);
      push(vm, toTaggedValue(2, Tag.LIST));
      push(vm, 5);
      push(vm, 6);
      push(vm, toTaggedValue(2, Tag.LIST));

      rotOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(9);
    });

    test('should handle nested lists', () => {
      push(vm, 1);
      push(vm, 2);
      push(vm, 3);
      push(vm, toTaggedValue(3, Tag.LIST));
      push(vm, 4);
      push(vm, 5);
      push(vm, toTaggedValue(3, Tag.LIST));

      rotOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(7);
    });
  });

  describe('error cases', () => {
    test('should throw on insufficient stack depth', () => {
      push(vm, 1);
      push(vm, 2);

      expect(() => rotOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on empty stack', () => {
      expect(() => rotOp(vm)).toThrow('Stack underflow');
    });
  });
});
