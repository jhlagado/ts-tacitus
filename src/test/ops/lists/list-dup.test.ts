/**
 * Tests for list duplication operations
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { parse } from '../../../lang/parser';
import { Tokenizer } from '../../../lang/tokenizer';
import { fromTaggedValue, Tag } from '../../../core/tagged';
import { execute } from '../../../lang/interpreter';
import { vm, initializeInterpreter } from '../../../core/globalState';

/**
 * Helper function to execute Tacit code and return the stack
 */
function executeCode(code: string): number[] {
  const tokenizer = new Tokenizer(code);
  parse(tokenizer);
  execute(0);
  return vm.getStackData();
}

describe('List duplication operations', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.SP = 0;
    vm.RP = 0;
    vm.BP = 0;
    vm.IP = 0;
    vm.listDepth = 0;
    vm.compiler.reset();
  });

  // Known issue: List tag not being set correctly
  test('should duplicate a simple list', () => {
    executeCode('( 1 2 ) dup');
    const stack = vm.getStackData();

    expect(stack.length).toBe(8);

    const { tag: firstListTag, value: firstListSize } = fromTaggedValue(stack[0]);
    expect(firstListTag).toBe(Tag.LIST);
    expect(firstListSize).toBe(2);
    expect(stack[1]).toBe(1);
    expect(stack[2]).toBe(2);

    const { tag: firstLinkTag, value: firstLinkValue } = fromTaggedValue(stack[3]);
    expect(firstLinkTag).toBe(Tag.LINK);
    expect(firstLinkValue).toBe(3);

    const { tag: secondListTag, value: secondListSize } = fromTaggedValue(stack[4]);
    expect(secondListTag).toBe(Tag.LIST);
    expect(secondListSize).toBe(2);
    expect(stack[5]).toBe(1);
    expect(stack[6]).toBe(2);

    const { tag: secondLinkTag, value: secondLinkValue } = fromTaggedValue(stack[7]);
    expect(secondLinkTag).toBe(Tag.LINK);
    expect(secondLinkValue).toBe(3);
  });

  test('should duplicate a larger list and preserve LINK tags', () => {
    executeCode('( 10 20 30 ) dup');
    const stack = vm.getStackData();

    /**
     * Expected stack layout:
     * [0] LIST(3) - Original list tag
     * [1] 10       - First element of original list
     * [2] 20       - Second element of original list
     * [3] 30       - Third element of original list
     * [4] LINK(4)  - Link tag for original list (points to 4 elements)
     * [5] LIST(3) - Duplicated list tag
     * [6] 10       - First element of duplicated list
     * [7] 20       - Second element of duplicated list
     * [8] 30       - Third element of duplicated list
     * [9] LINK(4)  - Link tag for duplicated list (points to 4 elements)
     */
    expect(stack.length).toBe(10);

    const { tag: origLinkTag, value: origLinkValue } = fromTaggedValue(stack[4]);
    expect(origLinkTag).toBe(Tag.LINK);
    expect(origLinkValue).toBe(4);

    const { tag: dupLinkTag } = fromTaggedValue(stack[9]);
    expect(dupLinkTag).toBe(Tag.LINK);
  });

  test('should duplicate a nested list', () => {
    executeCode('( 1 ( 2 3 ) 4 )');

    /**
     * Initial stack layout (before dup):
     * [0] LIST(3)  - Outer list tag with 3 elements
     * [1] 1         - First element of outer list
     * [2] LIST(2)  - Second element (inner list) with 2 elements
     * [3] 2         - First element of inner list
     * [4] 3         - Second element of inner list
     * [5] 4         - Third element of outer list
     * [6] LINK(6)   - Link tag for outer list (points back 6 elements)
     */
    const stackBeforeDup = vm.getStackData();
    const originalLength = stackBeforeDup.length;

    executeCode('dup');
    const dupStack = vm.getStackData();

    /**
     * Expected stack layout after dup:
     * [0] LIST(3)  - Original outer list tag
     * [1] 1         - First element of original outer list
     * [2] LIST(2)  - Original inner list tag
     * [3] 2         - First element of original inner list
     * [4] 3         - Second element of original inner list
     * [5] 4         - Third element of original outer list
     * [6] LINK(6)   - Link tag for original outer list
     * [7] LIST(3)  - Duplicated outer list tag
     * [8] 1         - First element of duplicated outer list
     * [9] LIST(2)  - Duplicated inner list tag
     * [10] 2        - First element of duplicated inner list
     * [11] 3        - Second element of duplicated inner list
     * [12] 4        - Third element of duplicated outer list
     * [13] LINK(6)  - Link tag for duplicated outer list
     */
    expect(dupStack.length).toBeGreaterThan(originalLength);

    // Verify the duplicated list has the correct structure by checking values
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

    expect(foundCount1).toBeGreaterThanOrEqual(2); // Value 1 appears twice (once per list)
    expect(foundCount2).toBeGreaterThanOrEqual(2); // Value 2 appears twice (once per inner list)
    expect(foundCount3).toBeGreaterThanOrEqual(2); // Value 3 appears twice (once per inner list)
    expect(foundCount4).toBeGreaterThanOrEqual(2); // Value 4 appears twice (once per outer list)

    // Verify we have the right number of LIST tags
    let listCount = 0;
    for (let i = 0; i < dupStack.length; i++) {
      const { tag } = fromTaggedValue(dupStack[i]);
      if (tag === Tag.LIST) listCount++;
    }
    expect(listCount).toBeGreaterThanOrEqual(4); // 2 outer lists + 2 inner lists
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

  test('should be able to operate on duplicated lists individually', () => {
    executeCode('( 1 2 ) dup');

    /**
     * Expected stack layout after ( 1 2 ) dup:
     * [0] LIST(2)  - First list tag
     * [1] 1         - First element of first list
     * [2] 2         - Second element of first list
     * [3] LINK(3)   - Link tag for first list
     * [4] LIST(2)  - Second list tag (duplicated)
     * [5] 1         - First element of second list
     * [6] 2         - Second element of second list
     * [7] LINK(3)   - Link tag for second list
     */
    const stack = vm.getStackData();
    expect(stack.length).toBe(8);

    executeCode('3 4');

    /**
     * Expected stack layout after pushing 3 and 4:
     * [0] LIST(2)  - First list tag
     * [1] 1         - First element of first list
     * [2] 2         - Second element of first list
     * [3] LINK(3)   - Link tag for first list
     * [4] LIST(2)  - Second list tag (duplicated)
     * [5] 1         - First element of second list
     * [6] 2         - Second element of second list
     * [7] LINK(3)   - Link tag for second list
     * [8] 3         - Additional value
     * [9] 4         - Additional value
     */
    const stackAfterPush = vm.getStackData();
    expect(stackAfterPush.length).toBe(10);

    const { tag: lastTag } = fromTaggedValue(stackAfterPush[stackAfterPush.length - 3]);
    expect(lastTag).toBe(Tag.LINK);
  });
});
