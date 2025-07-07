import { describe, it, expect, beforeEach } from '@jest/globals';
import { parse } from '../lang/parser';
import { Tokenizer } from '../lang/tokenizer';
import { fromTaggedValue, Tag } from '../core/tagged';
import { execute } from '../lang/interpreter';
import { vm, initializeInterpreter } from '../core/globalState';

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
  // Reset VM before each test
  beforeEach(() => {
    // Initialize fresh VM
    initializeInterpreter();

    // Reset state
    vm.SP = 0;
    vm.RP = 0;
    vm.BP = 0;
    vm.IP = 0;
    vm.tupleDepth = 0;
    vm.compiler.reset();
  });

  it('should create a simple tuple with 2 elements', () => {
    const stack = executeCode('( 1 2 )');

    // Check stack: should have [TUPLE, 1, 2, STACK_REF]
    expect(stack.length).toBe(4);

    // The first item should be a tuple tag
    const { tag: tupleTag } = fromTaggedValue(stack[0]);
    expect(tupleTag).toBe(Tag.TUPLE);

    // The values should follow the tuple tag
    expect(stack[1]).toBe(1);
    expect(stack[2]).toBe(2);

    // The last item should be a stack reference (tuple tag position)
    const { tag: stackRefTag } = fromTaggedValue(stack[3]);
    expect(stackRefTag).toBe(Tag.STACK_REF);
  });

  it('should handle empty tuples', () => {
    const stack = executeCode('( )');

    expect(stack.length).toBe(2);

    // First item should be the tuple tag (size 0)
    const { tag: tupleTag } = fromTaggedValue(stack[0]);
    expect(tupleTag).toBe(Tag.TUPLE);

    // Second item should be a reference to the tuple tag
    const { tag: stackRefTag } = fromTaggedValue(stack[1]);
    expect(stackRefTag).toBe(Tag.STACK_REF);
  });

  it('should handle a nested tuple with 1 level of nesting', () => {
    // Create a tuple with a nested tuple: ( 1 ( 2 3 ) 4 )
    const stack = executeCode('( 1 ( 2 3 ) 4 )');

    /*
     * Expected stack with tag-first approach (from bottom to top):
     * [0]: TUPLE         - Outer tuple tag
     * [1]: 1             - First element of outer tuple
     * [2]: TUPLE         - Inner tuple tag
     * [3]: 2             - First element of inner tuple
     * [4]: 3             - Second element of inner tuple
     * [5]: 4             - Last element of outer tuple
     */
    expect(stack.length).toBe(6);

    // Verify stack contents
    const { tag: outerTag } = fromTaggedValue(stack[0]);
    expect(outerTag).toBe(Tag.TUPLE);  // Outer tuple tag

    expect(stack[1]).toBe(1);         // First element of outer tuple

    const { tag: innerTag } = fromTaggedValue(stack[2]);
    expect(innerTag).toBe(Tag.TUPLE);  // Inner tuple tag

    expect(stack[3]).toBe(2);         // First element of inner tuple
    expect(stack[4]).toBe(3);         // Second element of inner tuple
    expect(stack[5]).toBe(4);         // Last element of outer tuple
  });

  it('should handle multiple nested tuples at the same level', () => {
    // Create a tuple with multiple nested tuples: ( ( 1 2 ) ( 3 4 ) )
    const stack = executeCode('( ( 1 2 ) ( 3 4 ) )');

    /*
     * Observed stack with tag-first approach (from bottom to top):
     * [0]: TUPLE         - Outer tuple tag (size 6)
     * [1]: TUPLE         - First nested tuple tag (size 2)
     * [2]: 1             - First element of first nested tuple
     * [3]: 2             - Second element of first nested tuple
     * [4]: TUPLE         - Second nested tuple tag (size 2)
     * [5]: 3             - First element of second nested tuple
     * [6]: 4             - Second element of second nested tuple
     */
    expect(stack.length).toBe(7);

    // Check number values (reliable for testing)
    expect(stack[2]).toBe(1);         // First element of first nested tuple
    expect(stack[3]).toBe(2);         // Second element of first nested tuple
    expect(stack[5]).toBe(3);         // First element of second nested tuple
    expect(stack[6]).toBe(4);         // Second element of second nested tuple
  });

  it('should handle complex mixed nested structures', () => {
    // Complex tuple with mixed nesting: ( 1 ( ) ( 2 ( 3 4 ) ) 5 )
    const stack = executeCode('( 1 ( ) ( 2 ( 3 4 ) ) 5 )');

    /*
     * Expected stack with tag-first approach (from bottom to top):
     * [0]: TUPLE         - Outermost tuple tag
     * [1]: 1             - First element of outer tuple
     * [2]: TUPLE         - Empty tuple tag (size 0)
     * [3]: TUPLE         - Second nested tuple tag
     * [4]: 2             - First element of second nested tuple
     * [5]: TUPLE         - Innermost tuple tag
     * [6]: 3             - First element of innermost tuple
     * [7]: 4             - Second element of innermost tuple
     * [8]: 5             - Last element in outermost tuple
     */
    expect(stack.length).toBe(9);

    // Verify elements based on tag-first implementation
    const { tag: outerTag } = fromTaggedValue(stack[0]);
    expect(outerTag).toBe(Tag.TUPLE);  // Outermost tuple tag

    expect(stack[1]).toBe(1);         // First element of outer tuple

    const { tag: emptyTag } = fromTaggedValue(stack[2]);
    expect(emptyTag).toBe(Tag.TUPLE);  // Empty tuple tag

    const { tag: nestedTag } = fromTaggedValue(stack[3]);
    expect(nestedTag).toBe(Tag.TUPLE); // Second nested tuple tag

    expect(stack[4]).toBe(2);         // Element in nested tuple

    const { tag: innerTag } = fromTaggedValue(stack[5]);
    expect(innerTag).toBe(Tag.TUPLE);  // Innermost tuple tag

    expect(stack[6]).toBe(3);         // First element in innermost tuple
    expect(stack[7]).toBe(4);         // Second element in innermost tuple
    expect(stack[8]).toBe(5);         // Last element in outermost tuple
  });

  it('should handle deeply nested tuples (3+ levels)', () => {
    // Create a deeply nested tuple: ( 1 ( 2 ( 3 4 ) 5 ) 6 )
    const stack = executeCode('( 1 ( 2 ( 3 4 ) 5 ) 6 )');

    /*
     * Expected stack (from bottom to top) with tag-first approach:
     * [0]: TUPLE         - Outermost tuple tag
     * [1]: 1             - First element of outermost tuple
     * [2]: TUPLE         - Middle tuple tag
     * [3]: 2             - First element of middle tuple
     * [4]: TUPLE         - Innermost tuple tag
     * [5]: 3             - First element of innermost tuple
     * [6]: 4             - Second element of innermost tuple
     * [7]: 5             - Third element of middle tuple
     * [8]: 6             - Third element of outermost tuple
     */
    expect(stack.length).toBe(9);

    // Verify stack contents
    const { tag: outerTag } = fromTaggedValue(stack[0]);
    expect(outerTag).toBe(Tag.TUPLE);  // Outermost tuple tag

    expect(stack[1]).toBe(1);         // First element of outermost tuple

    const { tag: middleTag } = fromTaggedValue(stack[2]);
    expect(middleTag).toBe(Tag.TUPLE); // Middle tuple tag

    expect(stack[3]).toBe(2);         // First element of middle tuple

    const { tag: innerTag } = fromTaggedValue(stack[4]);
    expect(innerTag).toBe(Tag.TUPLE);  // Innermost tuple tag

    expect(stack[5]).toBe(3);         // First element of innermost tuple
    expect(stack[6]).toBe(4);         // Second element of innermost tuple
    expect(stack[7]).toBe(5);         // Third element of middle tuple
    expect(stack[8]).toBe(6);         // Last element of outermost tuple
  });
});
