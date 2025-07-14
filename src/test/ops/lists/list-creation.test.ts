/**
 * Tests for list creation operations
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

  describe('Basic lists', () => {
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
  });
});
