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

describe('Tuple creation operations', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.SP = 0;
    vm.RP = 0;
    vm.BP = 0;
    vm.IP = 0;
    vm.tupleDepth = 0;
    vm.compiler.reset();
  });

  describe('creation', () => {
    test('should create a simple tuple with 2 elements', () => {
      const stack = executeCode('( 1 2 )');

      /**
       * Expected stack layout:
       * [0] TUPLE(2)  - Tuple tag with size 2
       * [1] 1         - First element of tuple
       * [2] 2         - Second element of tuple
       * [3] LINK(3)   - Link tag with offset 3 (points back to tuple start)
       */
      expect(stack.length).toBe(4);
      const { tag: tupleTag, value: tupleSize } = fromTaggedValue(stack[0]);
      expect(tupleTag).toBe(Tag.TUPLE);
      expect(tupleSize).toBe(2);
      expect(stack[1]).toBe(1);
      expect(stack[2]).toBe(2);
      const { tag: linkTag } = fromTaggedValue(stack[3]);
      expect(linkTag).toBe(Tag.LINK);
    });
    test('should handle empty tuples', () => {
      const stack = executeCode('( )');

      /**
       * Expected stack layout:
       * [0] TUPLE(0)  - Tuple tag with size 0 (empty tuple)
       * [1] LINK(1)   - Link tag with offset 1 (points back to tuple start)
       */
      expect(stack.length).toBe(2);
      const { tag: tupleTag, value: tupleSize } = fromTaggedValue(stack[0]);
      expect(tupleTag).toBe(Tag.TUPLE);
      expect(tupleSize).toBe(0);
      const { tag: linkTag } = fromTaggedValue(stack[1]);
      expect(linkTag).toBe(Tag.LINK);
    });
    test('should handle a nested tuple with 1 level of nesting', () => {
      const stack = executeCode('( 1 ( 2 3 ) 4 )');

      /**
       * Expected stack layout:
       * [0]: TUPLE         - Outer tuple tag
       * [1]: 1             - First element of outer tuple
       * [2]: TUPLE         - Inner tuple tag
       * [3]: 2             - First element of inner tuple
       * [4]: 3             - Second element of inner tuple
       * [5]: 4             - Last element of outer tuple
       * [6]: LINK          - Link to the outer tuple tag
       */

      console.log('Nested tuple with LINK verification:');
      for (let i = 0; i < stack.length; i++) {
        const { tag, value } = fromTaggedValue(stack[i]);
        console.log(`[${i}] Value: ${value}, Tag: ${Tag[tag]} (${tag})`);
      }

      const { tag: outerTag } = fromTaggedValue(stack[0]);
      expect(outerTag).toBe(Tag.TUPLE);

      const { tag: innerTag } = fromTaggedValue(stack[2]);
      expect(innerTag).toBe(Tag.TUPLE);

      expect(stack[1]).toBe(1);
      expect(stack[3]).toBe(2);
      expect(stack[4]).toBe(3);
      expect(stack[5]).toBe(4);

      const lastIndex = stack.length - 1;
      const { tag: lastTag } = fromTaggedValue(stack[lastIndex]);
      expect(lastTag).toBe(Tag.LINK);

      expect(stack.length).toBe(7);
    });
    test('should handle multiple nested tuples at the same level', () => {
      const stack = executeCode('( ( 1 2 ) ( 3 4 ) )');

      /**
       * Expected stack layout:
       * [0] TUPLE(2)  - Outer tuple with 2 elements (both are inner tuples)
       * [1] TUPLE(2)  - First inner tuple with 2 elements
       * [2] 1         - First element of first inner tuple
       * [3] 2         - Second element of first inner tuple
       * [4] TUPLE(2)  - Second inner tuple with 2 elements
       * [5] 3         - First element of second inner tuple
       * [6] 4         - Second element of second inner tuple
       * [7] LINK(7)   - Link tag for outer tuple (points back 7 elements)
       */
      expect(stack.length).toBe(8);
      expect(stack[2]).toBe(1);
      expect(stack[3]).toBe(2);
      expect(stack[5]).toBe(3);
      expect(stack[6]).toBe(4);

      const { tag: linkTag } = fromTaggedValue(stack[stack.length - 1]);
      expect(linkTag).toBe(Tag.LINK);
    });
    test('should handle complex mixed nested structures', () => {
      const stack = executeCode('( 1 ( ) ( 2 ( 3 4 ) ) 5 )');

      /**
       * Expected stack layout:
       * [0] TUPLE(4)  - Outer tuple with 4 elements
       * [1] 1         - First element of outer tuple
       * [2] TUPLE(0)  - Second element (empty tuple)
       * [3] TUPLE(2)  - Third element (tuple with 2 elements)
       * [4] 2         - First element of tuple at index 3
       * [5] TUPLE(2)  - Second element of tuple at index 3 (another nested tuple)
       * [6] 3         - First element of innermost tuple
       * [7] 4         - Second element of innermost tuple
       * [8] 5         - Fourth element of outer tuple
       * [9] LINK(9)   - Link tag for outer tuple (points back 9 elements)
       */
      expect(stack.length).toBe(10);
      expect(stack[1]).toBe(1);
      expect(stack[4]).toBe(2);
      expect(stack[6]).toBe(3);
      expect(stack[7]).toBe(4);
      expect(stack[8]).toBe(5);

      const { tag: linkTag } = fromTaggedValue(stack[stack.length - 1]);
      expect(linkTag).toBe(Tag.LINK);
    });
    test('should handle deeply nested tuples (3+ levels)', () => {
      const stack = executeCode('( 1 ( 2 ( 3 4 ) 5 ) 6 )');

      /**
       * Expected stack layout:
       * [0] TUPLE(3)  - Outermost tuple tag with 3 elements
       * [1] 1         - First element of outermost tuple
       * [2] TUPLE(3)  - Middle tuple tag with 3 elements
       * [3] 2         - First element of middle tuple
       * [4] TUPLE(2)  - Innermost tuple tag with 2 elements
       * [5] 3         - First element of innermost tuple
       * [6] 4         - Second element of innermost tuple
       * [7] 5         - Third element of middle tuple
       * [8] 6         - Third element of outermost tuple
       * [9] LINK(9)   - Link tag for outermost tuple (points back 9 elements)
       */
      expect(stack.length).toBe(10);
      const { tag: outerTag } = fromTaggedValue(stack[0]);
      expect(outerTag).toBe(Tag.TUPLE);
      expect(stack[1]).toBe(1);

      const { tag: middleTag } = fromTaggedValue(stack[2]);
      expect(middleTag).toBe(Tag.TUPLE);
      expect(stack[3]).toBe(2);

      const { tag: innerTag } = fromTaggedValue(stack[4]);
      expect(innerTag).toBe(Tag.TUPLE);
      expect(stack[5]).toBe(3);
      expect(stack[6]).toBe(4);

      expect(stack[7]).toBe(5);
      expect(stack[8]).toBe(6);

      const { tag: linkTag } = fromTaggedValue(stack[stack.length - 1]);
      expect(linkTag).toBe(Tag.LINK);
    });
  });
});
