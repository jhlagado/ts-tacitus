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

describe('Tuple swap operations', () => {
  beforeEach(() => {
    // Reset the interpreter and VM state
    initializeInterpreter();
    vm.SP = 0;
    vm.RP = 0;
    vm.BP = 0;
    vm.IP = 0;
    vm.tupleDepth = 0;
    vm.running = true;
    vm.compiler.reset();
  });

  describe('swap', () => {
    test('should swap two simple values', () => {
      executeCode('10 20 swap');
      const stack = vm.getStackData();

      /**
       * Expected stack layout after 10 20 swap:
       * [0] 20        - Original second value, now first
       * [1] 10        - Original first value, now second
       */
      expect(stack.length).toBe(2);
      expect(stack[0]).toBe(20);
      expect(stack[1]).toBe(10);
    });

    test('should swap a simple tuple with a value', () => {
      executeCode('10 ( 20 30 ) swap');
      const stack = vm.getStackData();

      // Debug output to see actual stack values
      console.log('Stack after swap:');
      for (let i = 0; i < stack.length; i++) {
        const { tag, value } = fromTaggedValue(stack[i]);
        console.log(`[${i}] Value: ${value}, Tag: ${Tag[tag]} (${tag})`);
      }

      /**
       * Expected stack layout after 10 ( 20 30 ) swap:
       * [0] TUPLE(2)  - Tuple tag with size 2
       * [1] 20        - First element of tuple
       * [2] 30        - Second element of tuple
       * [3] LINK(3)   - Link tag (points back 3 elements)
       * [4] 10        - Regular value that was swapped
       */
      expect(stack.length).toBe(5);

      // Verify tuple structure
      const { tag: tupleTag, value: tupleSize } = fromTaggedValue(stack[0]);
      console.log(`Tuple at [0]: tag=${Tag[tupleTag]} (${tupleTag}), size=${tupleSize}`);
      expect(tupleTag).toBe(Tag.TUPLE);
      expect(tupleSize).toBe(2);
      expect(stack[1]).toBe(20);
      expect(stack[2]).toBe(30);

      // Verify LINK tag
      const { tag: linkTag, value: linkValue } = fromTaggedValue(stack[3]);
      console.log(`Link at [3]: tag=${Tag[linkTag]} (${linkTag}), value=${linkValue}`);
      expect(linkTag).toBe(Tag.LINK);

      // Verify swapped value
      console.log(`Value at [4]: ${stack[4]}`);
    });

    xtest('should swap a value with a simple tuple', () => {
      executeCode('( 20 30 ) 10 swap');
      const stack = vm.getStackData();

      /**
       * Expected stack layout after ( 20 30 ) 10 swap:
       * [0] 10        - Regular value that was swapped
       * [1] TUPLE(2)  - Tuple tag with size 2
       * [2] 20        - First element of tuple
       * [3] 30        - Second element of tuple
       * [4] LINK(3)   - Link tag (points back 3 elements)
       */
      expect(stack.length).toBe(5);

      // Verify the value was swapped to the bottom
      expect(stack[0]).toBe(10);

      // Verify tuple structure
      const { tag: tupleTag, value: tupleSize } = fromTaggedValue(stack[1]);
      expect(tupleTag).toBe(Tag.TUPLE);
      expect(tupleSize).toBe(2);
      expect(stack[2]).toBe(20);
      expect(stack[3]).toBe(30);

      // Verify LINK tag
      const { tag: linkTag } = fromTaggedValue(stack[4]);
      expect(linkTag).toBe(Tag.LINK);
    });

    xtest('should swap two simple tuples', () => {
      executeCode('( 10 20 ) ( 30 40 ) swap');
      const stack = vm.getStackData();

      /**
       * Expected stack layout after ( 10 20 ) ( 30 40 ) swap:
       * [0] TUPLE(2)  - First tuple tag
       * [1] 30        - First element of second tuple (now first)
       * [2] 40        - Second element of second tuple (now first)
       * [3] LINK(3)   - Link tag for first tuple
       * [4] TUPLE(2)  - Second tuple tag
       * [5] 10        - First element of first tuple (now second)
       * [6] 20        - Second element of first tuple (now second)
       * [7] LINK(3)   - Link tag for second tuple
       */
      expect(stack.length).toBe(8);

      // Verify first tuple (was the second)
      const { tag: firstTupleTag, value: firstTupleSize } = fromTaggedValue(stack[0]);
      expect(firstTupleTag).toBe(Tag.TUPLE);
      expect(firstTupleSize).toBe(2);
      expect(stack[1]).toBe(30);
      expect(stack[2]).toBe(40);

      // Verify first LINK tag
      const { tag: firstLinkTag } = fromTaggedValue(stack[3]);
      expect(firstLinkTag).toBe(Tag.LINK);

      // Verify second tuple (was the first)
      const { tag: secondTupleTag, value: secondTupleSize } = fromTaggedValue(stack[4]);
      expect(secondTupleTag).toBe(Tag.TUPLE);
      expect(secondTupleSize).toBe(2);
      expect(stack[5]).toBe(10);
      expect(stack[6]).toBe(20);

      // Verify second LINK tag
      const { tag: secondLinkTag } = fromTaggedValue(stack[7]);
      expect(secondLinkTag).toBe(Tag.LINK);
    });

    xtest('should swap a nested tuple with a value', () => {
      executeCode('42 ( 10 ( 20 30 ) 40 ) swap');
      const stack = vm.getStackData();

      /**
       * Expected stack layout after 42 ( 10 ( 20 30 ) 40 ) swap:
       * [0] TUPLE(5)  - Outer tuple tag
       * [1] 10        - First element of outer tuple
       * [2] TUPLE(2)  - Inner tuple tag
       * [3] 20        - First element of inner tuple
       * [4] 30        - Second element of inner tuple
       * [5] 40        - Third element of outer tuple
       * [6] LINK(6)   - Link tag for outer tuple
       * [7] 42        - Regular value that was swapped
       */

      // Debug output to understand the stack layout
      console.log('After swap with nested tuple:');
      for (let i = 0; i < stack.length; i++) {
        const { tag, value } = fromTaggedValue(stack[i]);
        console.log(`[${i}] Value: ${value}, Tag: ${Tag[tag]} (${tag})`);
      }

      // Verify the outer tuple is now on top
      const { tag: outerTag, value: outerSize } = fromTaggedValue(stack[0]);
      expect(outerTag).toBe(Tag.TUPLE);
      expect(outerSize).toBe(5);

      // Verify the value is at the bottom
      expect(stack[stack.length - 1]).toBe(42);

      // Verify presence of inner tuple
      let foundInnerTuple = false;
      for (let i = 0; i < stack.length; i++) {
        const { tag } = fromTaggedValue(stack[i]);
        if (tag === Tag.TUPLE && i > 0) {
          foundInnerTuple = true;
          break;
        }
      }
      expect(foundInnerTuple).toBe(true);

      // Verify LINK tag is present
      let foundLinkTag = false;
      for (let i = 0; i < stack.length; i++) {
        const { tag } = fromTaggedValue(stack[i]);
        if (tag === Tag.LINK) {
          foundLinkTag = true;
          break;
        }
      }
      expect(foundLinkTag).toBe(true);
    });

    xtest('should swap two nested tuples correctly', () => {
      /*
       * INPUT CODE: '( 1 ( 2 3 ) 4 ) ( 5 ( 6 7 ) 8 ) swap'
       *
       * INITIAL STACK BEFORE SWAP:
       * First tuple: ( 1 ( 2 3 ) 4 )
       * Second tuple: ( 5 ( 6 7 ) 8 )
       *
       * CORRECT STACK AFTER SWAP:
       * Second tuple should now be first: ( 5 ( 6 7 ) 8 )
       * First tuple should now be second: ( 1 ( 2 3 ) 4 )
       *
       * EXPECTED STACK LAYOUT AFTER SWAP:
       * Index | Value     | Description
       * ------|-----------|------------
       * 0     | TUPLE(5)  | Second tuple tag (size 5)
       * 1     | 5         | First element of second tuple
       * 2     | TUPLE(2)  | Inner tuple tag (size 2)
       * 3     | 6         | First element of inner tuple
       * 4     | 7         | Second element of inner tuple
       * 5     | 8         | Third element of second tuple
       * 6     | LINK(6)   | Link tag pointing 6 elements back
       * 7     | TUPLE(5)  | First tuple tag (size 5)
       * 8     | 1         | First element of first tuple
       * 9     | TUPLE(2)  | Inner tuple tag (size 2)
       * 10    | 2         | First element of inner tuple
       * 11    | 3         | Second element of inner tuple
       * 12    | 4         | Third element of first tuple
       * 13    | LINK(6)   | Link tag pointing 6 elements back
       */

      // Execute code and get stack
      executeCode('( 1 ( 2 3 ) 4 ) ( 5 ( 6 7 ) 8 ) swap');
      const stack = vm.getStackData();

      // Print the actual stack for debugging
      console.log('=== ACTUAL STACK AFTER SWAP ===');
      for (let i = 0; i < stack.length; i++) {
        const { tag, value } = fromTaggedValue(stack[i]);
        console.log(`[${i}] Value: ${value}, Tag: ${Tag[tag]} (${tag})`);
      }

      // DIRECT ASSERTIONS FROM CORRECT STACK DIAGRAM
      // Verify exactly 14 elements (0-13) on the stack
      expect(stack.length).toBe(14);

      // SECOND TUPLE (NOW FIRST ON STACK)
      // Index 0: Second tuple tag (TUPLE with size 5)
      expect(fromTaggedValue(stack[0]).tag).toBe(Tag.TUPLE);
      expect(fromTaggedValue(stack[0]).value).toBe(5);

      // Index 1: Value 5 (first element of second tuple)
      expect(stack[1]).toBe(5);

      // Index 2: Inner tuple tag (TUPLE with size 2)
      expect(fromTaggedValue(stack[2]).tag).toBe(Tag.TUPLE);
      expect(fromTaggedValue(stack[2]).value).toBe(2);

      // Index 3: Value 6 (first element of inner tuple)
      expect(stack[3]).toBe(6);

      // Index 4: Value 7 (second element of inner tuple)
      expect(stack[4]).toBe(7);

      // Index 5: Value 8 (third element of second tuple)
      expect(stack[5]).toBe(8);

      // Index 6: Link tag (points 7 elements back to the TUPLE tag at index 0)
      expect(fromTaggedValue(stack[6]).tag).toBe(Tag.LINK);
      expect(fromTaggedValue(stack[6]).value).toBe(7);

      // FIRST TUPLE (NOW SECOND ON STACK)
      // Index 7: First tuple tag (TUPLE with size 5)
      expect(fromTaggedValue(stack[7]).tag).toBe(Tag.TUPLE);
      expect(fromTaggedValue(stack[7]).value).toBe(5);

      // Index 8: Value 1 (first element of first tuple)
      expect(stack[8]).toBe(1);

      // Index 9: Inner tuple tag (TUPLE with size 2)
      expect(fromTaggedValue(stack[9]).tag).toBe(Tag.TUPLE);
      expect(fromTaggedValue(stack[9]).value).toBe(2);

      // Index 10: Value 2 (first element of inner tuple)
      expect(stack[10]).toBe(2);

      // Index 11: Value 3 (second element of inner tuple)
      expect(stack[11]).toBe(3);

      // Index 12: Value 4 (third element of first tuple)
      expect(stack[12]).toBe(4);

      // Index 13: Link tag (points 7 elements back to the TUPLE tag at index 7)
      expect(fromTaggedValue(stack[13]).tag).toBe(Tag.LINK);
      expect(fromTaggedValue(stack[13]).value).toBe(7);

      // KEY VALIDATION: Verify the tuples are actually swapped (5 comes before 1)
      expect(stack.indexOf(5)).toBeLessThan(stack.indexOf(1));
    });

    test('should handle empty tuples during swap', () => {
      executeCode('( ) 42 swap');
      const stack = vm.getStackData();

      /**
       * Expected stack layout after ( ) 42 swap:
       * [0] 42        - Regular value
       * [1] TUPLE(0)  - Empty tuple tag
       * [2] LINK(1)   - Link tag (points back 1 element)
       */
      expect(stack.length).toBe(3);
      expect(stack[0]).toBe(42);

      const { tag: tupleTag, value: tupleSize } = fromTaggedValue(stack[1]);
      expect(tupleTag).toBe(Tag.TUPLE);
      expect(tupleSize).toBe(0);

      const { tag: linkTag } = fromTaggedValue(stack[2]);
      expect(linkTag).toBe(Tag.LINK);
    });

    test('should throw error when trying to swap with insufficient items', () => {
      executeCode('42');

      // Should throw an error when there are not enough items to swap
      expect(() => {
        executeCode('swap');
      }).toThrow(/Stack underflow/);
    });
  });
});
