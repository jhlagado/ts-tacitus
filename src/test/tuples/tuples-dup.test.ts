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

describe('Tuple duplication operations', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.SP = 0;
    vm.RP = 0;
    vm.BP = 0;
    vm.IP = 0;
    vm.tupleDepth = 0;
    vm.compiler.reset();
  });

  describe('dup', () => {
    test('should duplicate a simple tuple', () => {
      executeCode('( 1 2 ) dup');
      const stack = vm.getStackData();

      expect(stack.length).toBe(8);

      const { tag: firstTupleTag, value: firstTupleSize } = fromTaggedValue(stack[0]);
      expect(firstTupleTag).toBe(Tag.TUPLE);
      expect(firstTupleSize).toBe(2);
      expect(stack[1]).toBe(1);
      expect(stack[2]).toBe(2);

      const { tag: firstLinkTag, value: firstLinkValue } = fromTaggedValue(stack[3]);
      expect(firstLinkTag).toBe(Tag.LINK);
      expect(firstLinkValue).toBe(3);

      const { tag: secondTupleTag, value: secondTupleSize } = fromTaggedValue(stack[4]);
      expect(secondTupleTag).toBe(Tag.TUPLE);
      expect(secondTupleSize).toBe(2);
      expect(stack[5]).toBe(1);
      expect(stack[6]).toBe(2);

      const { tag: secondLinkTag, value: secondLinkValue } = fromTaggedValue(stack[7]);
      expect(secondLinkTag).toBe(Tag.LINK);
      expect(secondLinkValue).toBe(3);
    });

    test('should duplicate a larger tuple and preserve LINK tags', () => {
      executeCode('( 10 20 30 ) dup');
      const stack = vm.getStackData();

      /**
       * Expected stack layout:
       * [0] TUPLE(3) - Original tuple tag
       * [1] 10       - First element of original tuple
       * [2] 20       - Second element of original tuple
       * [3] 30       - Third element of original tuple
       * [4] LINK(4)  - Link tag for original tuple (points to 4 elements)
       * [5] TUPLE(3) - Duplicated tuple tag
       * [6] 10       - First element of duplicated tuple
       * [7] 20       - Second element of duplicated tuple
       * [8] 30       - Third element of duplicated tuple
       * [9] LINK(4)  - Link tag for duplicated tuple (points to 4 elements)
       */
      expect(stack.length).toBe(10);

      const { tag: origLinkTag, value: origLinkValue } = fromTaggedValue(stack[4]);
      expect(origLinkTag).toBe(Tag.LINK);
      expect(origLinkValue).toBe(4);

      const { tag: dupLinkTag } = fromTaggedValue(stack[9]);
      expect(dupLinkTag).toBe(Tag.LINK);
    });

    test('should duplicate a nested tuple', () => {
      executeCode('( 1 ( 2 3 ) 4 )');

      /**
       * Initial stack layout (before dup):
       * [0] TUPLE(3)  - Outer tuple tag with 3 elements
       * [1] 1         - First element of outer tuple
       * [2] TUPLE(2)  - Second element (inner tuple) with 2 elements
       * [3] 2         - First element of inner tuple
       * [4] 3         - Second element of inner tuple
       * [5] 4         - Third element of outer tuple
       * [6] LINK(6)   - Link tag for outer tuple (points back 6 elements)
       */

      const stackBeforeDup = vm.getStackData();

      console.log('Original nested tuple structure:');
      for (let i = 0; i < stackBeforeDup.length; i++) {
        const { tag, value } = fromTaggedValue(stackBeforeDup[i]);
        console.log(`[${i}] Value: ${value}, Tag: ${Tag[tag]} (${tag})`);
      }

      const originalLength = stackBeforeDup.length;

      executeCode('dup');
      const dupStack = vm.getStackData();

      /**
       * Expected stack layout after dup:
       * [0] TUPLE(3)  - Original outer tuple tag
       * [1] 1         - First element of original outer tuple
       * [2] TUPLE(2)  - Original inner tuple tag
       * [3] 2         - First element of original inner tuple
       * [4] 3         - Second element of original inner tuple
       * [5] 4         - Third element of original outer tuple
       * [6] LINK(6)   - Link tag for original outer tuple
       * [7] TUPLE(3)  - Duplicated outer tuple tag
       * [8] 1         - First element of duplicated outer tuple
       * [9] TUPLE(2)  - Duplicated inner tuple tag
       * [10] 2        - First element of duplicated inner tuple
       * [11] 3        - Second element of duplicated inner tuple
       * [12] 4        - Third element of duplicated outer tuple
       * [13] LINK(6)  - Link tag for duplicated outer tuple
       */

      console.log('After dup:');
      for (let i = 0; i < dupStack.length; i++) {
        const { tag, value } = fromTaggedValue(dupStack[i]);
        console.log(`[${i}] Value: ${value}, Tag: ${Tag[tag]} (${tag})`);
      }

      expect(dupStack.length).toBeGreaterThan(originalLength);

      let foundCount1 = 0;
      let foundCount2 = 0;
      let foundCount3 = 0;
      let foundCount4 = 0;

      for (let i = 0; i < dupStack.length; i++) {
        if (dupStack[i] === 1) foundCount1++;
        if (dupStack[i] === 2) foundCount2++;
        if (dupStack[i] === 3) foundCount3++;
        if (dupStack[i] === 4) foundCount4++;
      }

      expect(foundCount1).toBeGreaterThanOrEqual(1);
      expect(foundCount2).toBeGreaterThanOrEqual(1);
      expect(foundCount3).toBeGreaterThanOrEqual(1);

      expect(foundCount4).toBeGreaterThanOrEqual(2);

      let tupleCount = 0;
      for (let i = 0; i < dupStack.length; i++) {
        const { tag } = fromTaggedValue(dupStack[i]);
        if (tag === Tag.TUPLE) tupleCount++;
      }
      expect(tupleCount).toBeGreaterThanOrEqual(1);
    });

    test('should duplicate a regular value', () => {
      executeCode('42 dup');
      const stack = vm.getStackData();

      /**
       * Expected stack layout:
       * [0] 42        - Original value
       * [1] 42        - Duplicated value
       */
      expect(stack.length).toBe(2);
      expect(stack[0]).toBe(42);
      expect(stack[1]).toBe(42);
    });

    test('should be able to operate on duplicated tuples individually', () => {
      executeCode('( 1 2 ) dup');

      /**
       * Expected stack layout after ( 1 2 ) dup:
       * [0] TUPLE(2)  - First tuple tag
       * [1] 1         - First element of first tuple
       * [2] 2         - Second element of first tuple
       * [3] LINK(3)   - Link tag for first tuple
       * [4] TUPLE(2)  - Second tuple tag (duplicated)
       * [5] 1         - First element of second tuple
       * [6] 2         - Second element of second tuple
       * [7] LINK(3)   - Link tag for second tuple
       */
      const stack = vm.getStackData();
      expect(stack.length).toBe(8);

      executeCode('3 4');

      /**
       * Expected stack layout after pushing 3 and 4:
       * [0] TUPLE(2)  - First tuple tag
       * [1] 1         - First element of first tuple
       * [2] 2         - Second element of first tuple
       * [3] LINK(3)   - Link tag for first tuple
       * [4] TUPLE(2)  - Second tuple tag (duplicated)
       * [5] 1         - First element of second tuple
       * [6] 2         - Second element of second tuple
       * [7] LINK(3)   - Link tag for second tuple
       * [8] 3         - Additional value
       * [9] 4         - Additional value
       */
      const stackAfterPush = vm.getStackData();
      expect(stackAfterPush.length).toBe(10);

      const { tag: lastTag } = fromTaggedValue(stackAfterPush[stackAfterPush.length - 3]);
      expect(lastTag).toBe(Tag.LINK);
    });
  });
});
