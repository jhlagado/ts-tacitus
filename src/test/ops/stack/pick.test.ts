import { VM } from '../../../core/vm';
import { pickOp } from '../../../ops/builtins-stack';
import { initializeInterpreter } from '../../../core/globalState';
import { pushList, getStackWithTags } from '../../../test/stack-utils';
import {
  testStackOperation,
  withStack,
  expectStackUnderflow,
} from '../../../test/stack-test-utils';

describe('pick Operation', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  describe('basic operations', () => {
    testStackOperation({
      name: 'should duplicate the top element when index is 0 (like dup)',
      setup: withStack(1, 0),
      operation: pickOp,
      expectedStack: [1, 1],
      verify: () => {},
    });

    testStackOperation({
      name: 'should duplicate the second element when index is 1 (like over)',
      setup: withStack(1, 2, 1),
      operation: pickOp,
      expectedStack: [1, 2, 1],
      verify: () => {},
    });
  });

  describe('edge cases', () => {
    test('should throw on stack underflow', () => {
      expectStackUnderflow(pickOp);
    });

    test('should throw on negative index', () => {
      const vm = new VM();
      vm.push(-1);
      expect(() => pickOp(vm)).toThrow('Invalid index for pick: -1');
    });

    test('should throw when index is out of bounds', () => {
      const vm = new VM();
      vm.push(1);
      vm.push(2);
      expect(() => pickOp(vm)).toThrow('Stack underflow in pick operation');
    });
  });

  describe('with lists', () => {
    test('should handle picking a list', () => {
      const vm = new VM();

      vm.push(5);
      pushList(vm, [10, 20]);

      vm.push(1);

      pickOp(vm);

      const stack = getStackWithTags(vm);

      expect(stack).toEqual([
        { value: 5, tag: 'NUMBER' },
        { value: 10, tag: 'NUMBER' },
        { value: 20, tag: 'NUMBER' },
        { value: 0, tag: 'NUMBER' },
        { value: 2, tag: 'LIST' },
        { value: 3, tag: 'LINK' },
      ]);
    });
  });
});
