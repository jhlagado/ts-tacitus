import { VM } from '../../core/vm';
import { pickOp } from '../builtins-stack';
import { initializeInterpreter } from '../../core/globalState';
import { pushList, getStackWithTags } from '../../test/stack-utils';
import { testStackOperation, withStack, expectStackUnderflow } from '../../test/stack-test-utils';

describe('pick Operation', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  describe('basic operations', () => {
    testStackOperation({
      name: 'should duplicate the top element when index is 0 (like dup)',
      setup: withStack(1, 0), // [1, 0] where 0 is the index
      operation: pickOp,
      expectedStack: [1, 1],
      verify: () => {}
    });

    testStackOperation({
      name: 'should duplicate the second element when index is 1 (like over)',
      setup: withStack(1, 2, 1), // [1, 2, 1] where 1 is the index
      operation: pickOp,
      expectedStack: [1, 2, 1],
      verify: () => {}
    });
  });

  describe('edge cases', () => {
    it('should throw on stack underflow', () => {
      expectStackUnderflow(pickOp);
    });

    it('should throw on negative index', () => {
      const vm = new VM();
      vm.push(-1);
      expect(() => pickOp(vm)).toThrow('Invalid index for pick: -1');
    });

    it('should throw when index is out of bounds', () => {
      const vm = new VM();
      vm.push(1);
      vm.push(2); // Only one element on stack, index 1 is out of bounds
      expect(() => pickOp(vm)).toThrow('Stack underflow in pick operation');
    });
  });

  describe('with lists', () => {
    it('should handle picking a list', () => {
      const vm = new VM();
      
      // Push initial value and list
      vm.push(5);
      pushList(vm, [10, 20]);
      
      // Push index to pick (1 = second item, which is the list)
      vm.push(1);
      
      // Execute pick
      pickOp(vm);
      
      // Get stack with decoded tags for verification
      const stack = getStackWithTags(vm);
      
      // The stack structure after picking the list is:
      // [5 (original value), 10, 20 (list elements), 0 (padding), 2 (LIST size), 3 (LINK offset)]
      expect(stack).toEqual([
        { value: 5, tag: 'NUMBER' },  // Original value
        { value: 10, tag: 'NUMBER' }, // First list element
        { value: 20, tag: 'NUMBER' }, // Second list element
        { value: 0, tag: 'NUMBER' },  // Padding/alignment
        { value: 2, tag: 'LIST' },    // LIST tag with size 2
        { value: 3, tag: 'LINK' }     // LINK tag with offset 3
      ]);
    });
  });
});
