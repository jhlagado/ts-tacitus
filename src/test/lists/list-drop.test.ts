/**
 * Tests for list drop operations
 */
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

describe('List drop operations', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.SP = 0;
    vm.RP = 0;
    vm.BP = 0;
    vm.IP = 0;
    vm.listDepth = 0;
    vm.compiler.reset();
  });

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
     * [0] LIST(2)  - List tag with size 2
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
     * [1] LIST(2)  - List tag with size 2
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
    const stackBeforeLength = vm.getStackData().length;
    executeCode('drop');
    const stackAfter = vm.getStackData().length;

    expect(stackAfter).toBe(0);
    expect(stackAfter).toBeLessThan(stackBeforeLength);

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
    // Get initial stack state to verify it has elements before dropping
    const stackBeforeLength = vm.getStackData().length;
    expect(stackBeforeLength).toBeGreaterThan(0);
    executeCode('drop');
    const stackAfter = vm.getStackData();

    expect(stackAfter.length).toBe(4);
    const { tag: listTag } = fromTaggedValue(stackAfter[0]);
    expect(listTag).toBe(Tag.LIST);
    expect(stackAfter[1]).toBe(1);
    expect(stackAfter[2]).toBe(2);
  });
});
