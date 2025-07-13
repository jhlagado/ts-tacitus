import { describe, test, expect, beforeEach } from '@jest/globals';
import { parse } from '@lang/parser';
import { Tokenizer } from '@lang/tokenizer';
import { fromTaggedValue, Tag } from '@core/tagged';
import { execute } from '@lang/interpreter';
import { vm, initializeInterpreter } from '@core/globalState';

/**
 * Helper function to execute Tacit code and return the stack
 */
function executeCode(code: string): number[] {
  console.log('Executing code:', code);
  const tokenizer = new Tokenizer(code);
  parse(tokenizer);
  
  // Enable debug mode for more detailed logging
  const originalDebug = vm.debug;
  vm.debug = true;
  
  try {
    execute(0);
    const stackData = vm.getStackData();
    
    // Log the stack contents for debugging
    console.log('Stack after execution:');
    stackData.forEach((value, index) => {
      try {
        const { tag, value: tagValue } = fromTaggedValue(value);
        console.log(`  [${index}]: value=${value}, tag=${Tag[tag]} (${tag}), tagValue=${tagValue}`);
      } catch (_) {
        console.log(`  [${index}]: value=${value} (failed to decode)`);
      }
    });
    
    return stackData;
  } finally {
    // Restore original debug setting
    vm.debug = originalDebug;
  }
}

describe('List creation operations', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.SP = 0;
    vm.RP = 0;
    vm.BP = 0;
    vm.IP = 0;
    vm.listDepth = 0;
    vm.compiler.reset();
  });

  describe('creation', () => {
    test('should create a simple list with 2 elements', () => {
      const stack = executeCode('( 1 2 )');

      /**
       * Expected stack layout:
       * [0] LIST(2)  - List tag with size 2
       * [1] 1         - First element of list
       * [2] 2         - Second element of list
       * [3] LINK(3)   - Link tag with offset 3 (points back to list start)
       */
      expect(stack.length).toBe(4);
      const { tag: listTag, value: listSize } = fromTaggedValue(stack[0]);
      expect(listTag).toBe(Tag.LIST);
      expect(listSize).toBe(2);
      expect(stack[1]).toBe(1);
      expect(stack[2]).toBe(2);
      const { tag: linkTag } = fromTaggedValue(stack[3]);
      expect(linkTag).toBe(Tag.LINK);
    });
    test('should handle empty lists', () => {
      const stack = executeCode('( )');

      /**
       * Expected stack layout:
       * [0] LIST(0)  - List tag with size 0 (empty list)
       * [1] LINK(1)   - Link tag with offset 1 (points back to list start)
       */
      expect(stack.length).toBe(2);
      const { tag: listTag, value: listSize } = fromTaggedValue(stack[0]);
      expect(listTag).toBe(Tag.LIST);
      expect(listSize).toBe(0);
      const { tag: linkTag } = fromTaggedValue(stack[1]);
      expect(linkTag).toBe(Tag.LINK);
    });
    test('should handle a nested list with 1 level of nesting', () => {
      const stack = executeCode('( 1 ( 2 3 ) 4 )');

      /**
       * Expected stack layout:
       * [0]: LIST         - Outer list tag
       * [1]: 1             - First element of outer list
       * [2]: LIST         - Inner list tag
       * [3]: 2             - First element of inner list
       * [4]: 3             - Second element of inner list
       * [5]: 4             - Last element of outer list
       * [6]: LINK          - Link to the outer list tag
       */

      console.log('Nested list with LINK verification:');
      for (let i = 0; i < stack.length; i++) {
        const { tag, value } = fromTaggedValue(stack[i]);
        console.log(`[${i}] Value: ${value}, Tag: ${Tag[tag]} (${tag})`);
      }

      const { tag: outerTag } = fromTaggedValue(stack[0]);
      expect(outerTag).toBe(Tag.LIST);

      const { tag: innerTag } = fromTaggedValue(stack[2]);
      expect(innerTag).toBe(Tag.LIST);

      expect(stack[1]).toBe(1);
      expect(stack[3]).toBe(2);
      expect(stack[4]).toBe(3);
      expect(stack[5]).toBe(4);

      const lastIndex = stack.length - 1;
      const { tag: lastTag } = fromTaggedValue(stack[lastIndex]);
      expect(lastTag).toBe(Tag.LINK);

      expect(stack.length).toBe(7);
    });
    test('should handle multiple nested lists at the same level', () => {
      const stack = executeCode('( ( 1 2 ) ( 3 4 ) )');

      /**
       * Expected stack layout:
       * [0] LIST(2)  - Outer list with 2 elements (both are inner lists)
       * [1] LIST(2)  - First inner list with 2 elements
       * [2] 1         - First element of first inner list
       * [3] 2         - Second element of first inner list
       * [4] LIST(2)  - Second inner list with 2 elements
       * [5] 3         - First element of second inner list
       * [6] 4         - Second element of second inner list
       * [7] LINK(7)   - Link tag for outer list (points back 7 elements)
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
       * [0] LIST(4)  - Outer list with 4 elements
       * [1] 1         - First element of outer list
       * [2] LIST(0)  - Second element (empty list)
       * [3] LIST(2)  - Third element (list with 2 elements)
       * [4] 2         - First element of list at index 3
       * [5] LIST(2)  - Second element of list at index 3 (another nested list)
       * [6] 3         - First element of innermost list
       * [7] 4         - Second element of innermost list
       * [8] 5         - Fourth element of outer list
       * [9] LINK(9)   - Link tag for outer list (points back 9 elements)
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
    test('should handle deeply nested lists (3+ levels)', () => {
      const stack = executeCode('( 1 ( 2 ( 3 4 ) 5 ) 6 )');

      /**
       * Expected stack layout:
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
       */
      expect(stack.length).toBe(10);
      const { tag: outerTag } = fromTaggedValue(stack[0]);
      expect(outerTag).toBe(Tag.LIST);
      expect(stack[1]).toBe(1);

      const { tag: middleTag } = fromTaggedValue(stack[2]);
      expect(middleTag).toBe(Tag.LIST);
      expect(stack[3]).toBe(2);

      const { tag: innerTag } = fromTaggedValue(stack[4]);
      expect(innerTag).toBe(Tag.LIST);
      expect(stack[5]).toBe(3);
      expect(stack[6]).toBe(4);

      expect(stack[7]).toBe(5);
      expect(stack[8]).toBe(6);

      const { tag: linkTag } = fromTaggedValue(stack[stack.length - 1]);
      expect(linkTag).toBe(Tag.LINK);
    });
  });
});
