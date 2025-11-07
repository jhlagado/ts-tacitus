import { toTaggedValue, Tag } from '../../../core/tagged';
import { vm } from '../../../lang/runtime';
import { pickOp } from '../../../ops/stack';
import { resetVM } from '../../utils/vm-test-utils';
import { push, getStackData } from '../../../core/vm';

describe('pick Operation', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('simple values', () => {
    test('should duplicate the top element when index is 0 (like dup)', () => {
      push(vm, 1);
      push(vm, 0);

      pickOp(vm);

      expect(getStackData(vm)).toEqual([1, 1]);
    });

    test('should duplicate the second element when index is 1 (like over)', () => {
      push(vm, 1);
      push(vm, 2);
      push(vm, 1);

      pickOp(vm);

      expect(getStackData(vm)).toEqual([1, 2, 1]);
    });

    test('should pick from deeper in the stack', () => {
      push(vm, 10);
      push(vm, 20);
      push(vm, 30);
      push(vm, 40);
      push(vm, 2);

      pickOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(5);
      expect(stack[0]).toBe(10);
      expect(stack[1]).toBe(20);
      expect(stack[2]).toBe(30);
      expect(stack[3]).toBe(40);
      expect(stack[4]).toBe(20);
    });
  });

  describe('list operations (LIST semantics)', () => {
    test('should pick a list from the stack', () => {
      push(vm, 10);
      push(vm, 20);
      push(vm, toTaggedValue(2, Tag.LIST));
      push(vm, 5);
      push(vm, 1);

      pickOp(vm);

      const stack = getStackData(vm);

      expect(stack.length).toBeGreaterThanOrEqual(5);
    });

    test('should pick a value over a list', () => {
      push(vm, 42);
      push(vm, 10);
      push(vm, 20);
      push(vm, toTaggedValue(2, Tag.LIST));
      push(vm, 1);

      pickOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(5);
      expect(stack[0]).toBe(42);
      expect(stack[stack.length - 1]).toBe(42);
    });
  });

  describe('error cases', () => {
    test('should throw on stack underflow', () => {
      expect(() => pickOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on negative index', () => {
      push(vm, -1);
      expect(() => pickOp(vm)).toThrow('Invalid index for pick: -1');
    });

    test('should throw when index is out of bounds', () => {
      push(vm, 1);
      push(vm, 2);
      expect(() => pickOp(vm)).toThrow('Stack underflow in pick operation');
    });

    test('should throw when stack has only the index', () => {
      push(vm, 0);
      expect(() => pickOp(vm)).toThrow('Stack underflow in pick operation');
    });
  });
});
