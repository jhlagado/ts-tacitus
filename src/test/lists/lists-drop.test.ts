import { describe, test, expect, beforeEach } from '@jest/globals';
import { parse } from '../../lang/parser';
import { Tokenizer } from '../../lang/tokenizer';
import { fromTaggedValue, Tag } from '../../core/tagged';
import { execute } from '../../lang/interpreter';

import { vm, initializeInterpreter } from '../../core/globalState';

/**
 * Helper function to execute Tacit code and return the stack
 */
function executeCode(code: string): number[] {
  const tokenizer = new Tokenizer(code);
  parse(tokenizer);
  execute(0);
  return vm.getStackData();
}

describe('Tuple operations', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.SP = 0;
    vm.RP = 0;
    vm.BP = 0;
    vm.IP = 0;
    vm.listDepth = 0;
    vm.compiler.reset();
  });

  describe('drop', () => {
    test('should drop a regular value from the stack', () => {
      executeCode('1 2 drop');

      /**
       * Expected stack layout after 1 2 drop:
       * [0] 1         - First value
       */
      const stack = vm.getStackData();
      expect(stack.length).toBe(1);
      expect(stack[0]).toBe(1);
    });
    test('should drop an entire simple list', () => {
      /**
       * Initial stack layout after ( 10 20 ):
       * [0] LIST(2)  - Tuple tag with size 2
       * [1] 10        - First element
       * [2] 20        - Second element
       * [3] LINK(3)   - Link tag (points back 3 elements)
       *
       * After drop:
       * [] Empty stack - The entire list is removed
       */
      const stack = executeCode('( 10 20 ) drop');
      expect(stack.length).toBe(0);

      executeCode('30');
      expect(vm.peek()).toBe(30);
    });
    test('should drop a list while leaving other values on stack', () => {
      /**
       * Initial stack layout after 5 ( 1 2 ):
       * [0] 5         - First value
       * [1] LIST(2)  - Tuple tag with size 2
       * [2] 1         - First element of list
       * [3] 2         - Second element of list
       * [4] LINK(3)   - Link tag (points back 3 elements)
       *
       * After drop:
       * [0] 5         - First value
       * [1] 10        - Additional value
       */
      const stack = executeCode('5 ( 1 2 ) drop 10');
      expect(stack.length).toBe(2);
      expect(stack[0]).toBe(5);
      expect(stack[1]).toBe(10);
    });
    test('should drop a nested list completely', () => {
      initializeInterpreter();
      executeCode('( 1 ( 2 3 ) 4 )');

      /**
       * Stack layout after creating the nested list:
       * [0] LIST(3)  - Outer list tag with 3 elements
       * [1] 1         - First element of outer list
       * [2] LIST(2)  - Inner list tag with 2 elements
       * [3] 2         - First element of inner list
       * [4] 3         - Second element of inner list
       * [5] 4         - Third element of outer list
       * [6] LINK(6)   - Link tag for outer list (points back 6 elements)
       *
       * After drop:
       * [] Empty stack - The entire nested list structure is removed
       */
      const stackBefore = vm.getStackData().length;
      executeCode('drop');
      const stackAfter = vm.getStackData().length;

      expect(stackAfter).toBe(0);
      expect(stackAfter).toBeLessThan(stackBefore);

      executeCode('42');
      expect(vm.peek()).toBe(42);
    });

    test('should drop only the top list when multiple lists are present', () => {
      initializeInterpreter();
      executeCode('( 1 2 )');
      executeCode('( 3 4 )');

      /**
       * Stack layout with two lists before drop:
       * [0] LIST(2)  - First list tag with 2 elements
       * [1] 1         - First element of first list
       * [2] 2         - Second element of first list
       * [3] LINK(3)   - Link tag for first list (points back 3 elements)
       * [4] LIST(2)  - Second list tag with 2 elements
       * [5] 3         - First element of second list
       * [6] 4         - Second element of second list
       * [7] LINK(3)   - Link tag for second list (points back 3 elements)
       *
       * After dropping the top (second) list:
       * [0] LIST(2)  - First list tag remains
       * [1] 1         - First element of first list remains
       * [2] 2         - Second element of first list remains
       * [3] LINK(3)   - Link tag for first list remains
       */

      const stackBeforeSize = vm.getStackData().length;

      const topTupleValues = [];
      const stack = vm.getStackData();
      for (let i = stackBeforeSize - 4; i < stackBeforeSize; i++) {
        topTupleValues.push(stack[i]);
      }

      executeCode('drop');

      const stackAfterSize = vm.getStackData().length;
      expect(stackAfterSize).toBe(stackBeforeSize - 4);

      const stackAfter = vm.getStackData();
      const { tag: topTag } = fromTaggedValue(stackAfter[stackAfterSize - 1]);
      expect(topTag).toBe(Tag.LINK);

      executeCode('100');
      expect(vm.peek()).toBe(100);
      vm.pop();
      executeCode('200');
      expect(vm.peek()).toBe(200);
    });

    test('should handle complex scenarios with multiple list operations', () => {
      initializeInterpreter();
      executeCode('( 1 ( 2 3 ) )');

      /**
       * Expected stack layout after ( 1 ( 2 3 ) ):
       * [0] LIST(2)  - Outer list tag with 2 elements
       * [1] 1         - First element of outer list
       * [2] LIST(2)  - Inner list tag with 2 elements
       * [3] 2         - First element of inner list
       * [4] 3         - Second element of inner list
       * [5] LINK(5)   - Link tag for outer list (points back 5 elements)
       */

      const stackAfterTuple = vm.getStackData();
      console.log('Stack after list creation:');
      for (let i = 0; i < stackAfterTuple.length; i++) {
        const { tag, value } = fromTaggedValue(stackAfterTuple[i]);
        console.log(`[${i}] Value: ${value}, Tag: ${Tag[tag]} (${tag})`);
      }

      executeCode('dup');

      /**
       * Expected stack layout after dup:
       * [0] LIST(2)  - Original outer list tag
       * [1] 1         - First element of original outer list
       * [2] LIST(2)  - Original inner list tag
       * [3] 2         - First element of original inner list
       * [4] 3         - Second element of original inner list
       * [5] LINK(5)   - Link tag for original outer list
       * [6] LIST(2)  - Duplicated outer list tag
       * [7] 1         - First element of duplicated outer list
       * [8] LIST(2)  - Duplicated inner list tag
       * [9] 2         - First element of duplicated inner list
       * [10] 3        - Second element of duplicated inner list
       * [11] LINK(5)  - Link tag for duplicated outer list
       */

      const stackAfterDup = vm.getStackData();
      console.log('Stack after dup:');
      for (let i = 0; i < stackAfterDup.length; i++) {
        const { tag, value } = fromTaggedValue(stackAfterDup[i]);
        console.log(`[${i}] Value: ${value}, Tag: ${Tag[tag]} (${tag})`);
      }

      expect(stackAfterDup.length).toBe(stackAfterTuple.length * 2);

      const { tag: firstTupleTag } = fromTaggedValue(stackAfterDup[0]);
      expect(firstTupleTag).toBe(Tag.LIST);

      executeCode('drop drop');

      /**
       * Expected stack layout after drop drop:
       * [] Empty stack - Both lists have been completely removed
       */

      expect(vm.getStackData().length).toBe(0);
    });

    test('should drop a deeply nested list in a single operation', () => {
      initializeInterpreter();
      executeCode('( 1 ( 2 ( 3 4 ) 5 ) 6 )');

      /**
       * Expected stack layout for deeply nested list:
       * [0] LIST(3)  - Outermost list tag with 3 elements
       * [1] 1         - First element of outermost list
       * [2] LIST(3)  - Middle list tag with 3 elements
       * [3] 2         - First element of middle list
       * [4] LIST(2)  - Innermost list tag with 2 elements
       * [5] 3         - First element of innermost list
       * [6] 4         - Second element of innermost list
       * [7] 5         - Third element of middle list
       * [8] 6         - Third element of outermost list
       * [9] LINK(9)   - Link tag for outermost list (points back 9 elements)
       *
       * After drop:
       * [] Empty stack - The entire list structure is removed
       */

      expect(vm.SP).toBeGreaterThan(0);
      executeCode('drop');

      expect(vm.getStackData().length).toBe(0);

      executeCode('123');
      expect(vm.peek()).toBe(123);
      vm.pop();
      executeCode('456');
      expect(vm.peek()).toBe(456);
    });

    test('should drop multiple lists consecutively', () => {
      initializeInterpreter();

      executeCode('( 10 20 )');

      /**
       * Expected stack layout after first list creation:
       * [0] LIST(2)  - Tuple tag with 2 elements
       * [1] 10        - First element
       * [2] 20        - Second element
       * [3] LINK(3)   - Link tag (points back 3 elements)
       *
       * After first drop:
       * [] Empty stack
       */
      executeCode('drop');
      expect(vm.getStackData().length).toBe(0);

      executeCode('( 30 40 )');

      /**
       * Expected stack layout after second list creation:
       * [0] LIST(2)  - Tuple tag with 2 elements
       * [1] 30        - First element
       * [2] 40        - Second element
       * [3] LINK(3)   - Link tag (points back 3 elements)
       *
       * After second drop:
       * [] Empty stack
       */
      executeCode('drop');
      expect(vm.getStackData().length).toBe(0);

      executeCode('50');
      expect(vm.peek()).toBe(50);
      executeCode('60');
      expect(vm.peek()).toBe(60);
      vm.pop();
      expect(vm.peek()).toBe(50);
    });

    test('should drop a list when directly referenced', () => {
      /**
       * Initial stack layout after ( 10 20 ) 30:
       * [0] LIST(2)  - Tuple tag with 2 elements
       * [1] 10        - First element
       * [2] 20        - Second element
       * [3] LINK(3)   - Link tag (points back 3 elements)
       * [4] 30        - Regular value
       *
       * After first drop:
       * [0] LIST(2)  - Tuple tag with 2 elements
       * [1] 10        - First element
       * [2] 20        - Second element
       * [3] LINK(3)   - Link tag (points back 3 elements)
       *
       * After second drop:
       * [] Empty stack - The entire list is removed
       */
      const stack = executeCode('( 10 20 ) 30 drop drop');
      expect(stack.length).toBe(0);
    });
  });
});
