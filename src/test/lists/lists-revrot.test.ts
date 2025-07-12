import { describe, test, expect, beforeEach } from '@jest/globals';
import { parse } from '../../lang/parser';
import { Tokenizer } from '../../lang/tokenizer';
import { fromTaggedValue, Tag } from '../../core/tagged';
import { findElement as _findElement } from '../../stack/find';
import { execute } from '../../lang/interpreter';
import { vm, initializeInterpreter } from '../../core/globalState';

/** Helper function to execute Tacit code and return the stack */
function executeCode(code: string): number[] {
  const tokenizer = new Tokenizer(code);
  parse(tokenizer);
  execute(0);
  return vm.getStackData();
}

describe('List revrot operations', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.SP = 0;
    vm.RP = 0;
    vm.BP = 0;
    vm.IP = 0;
    vm.listDepth = 0;
    vm.compiler.reset();
  });

  describe('revrot', () => {
    test('should reverse rotate three simple values', () => {
      executeCode('1 2 3 revrot');
      const stack = vm.getStackData();
      expect(stack.length).toBe(3);

      const val1 = fromTaggedValue(stack[0]);
      const val2 = fromTaggedValue(stack[1]);
      const val3 = fromTaggedValue(stack[2]);

      expect(val1.value).toBe(3);
      expect(val2.value).toBe(1);
      expect(val3.value).toBe(2);
    });

    test('should reverse rotate a list with two simple values', () => {
      executeCode('(1 2) 3 4');
      executeCode('revrot');
      const stack = vm.getStackData();

      expect(stack.length).toBe(6);

      const val1 = fromTaggedValue(stack[0]);
      expect(val1.value).toBe(4);
      expect(val1.tag).toBe(0);

      const listTag = fromTaggedValue(stack[1]);
      expect(listTag.tag).toBe(Tag.LIST);
      expect(listTag.value).toBe(2);

      const elem1 = fromTaggedValue(stack[2]);
      const elem2 = fromTaggedValue(stack[3]);
      expect(elem1.value).toBe(1);
      expect(elem1.tag).toBe(0);
      expect(elem2.value).toBe(2);
      expect(elem2.tag).toBe(0);

      const linkTag = fromTaggedValue(stack[4]);
      expect(linkTag.tag).toBe(Tag.LINK);
      expect(linkTag.value).toBe(3);

      const val3 = fromTaggedValue(stack[5]);
      expect(val3.value).toBe(3);
      expect(val3.tag).toBe(0);
    });

    test('should handle nested lists', () => {
      executeCode('((1 2) 3) 4 5 revrot');
      const stack = vm.getStackData();

      expect(stack.length).toBe(8);

      const val1 = fromTaggedValue(stack[0]);
      expect(val1.value).toBe(5);
      expect(val1.tag).toBe(0);

      const outerListTag = fromTaggedValue(stack[1]);
      expect(outerListTag.tag).toBe(Tag.LIST);
      expect(outerListTag.value).toBe(2);

      const innerListTag = fromTaggedValue(stack[2]);
      expect(innerListTag.tag).toBe(Tag.LIST);
      expect(innerListTag.value).toBe(2);

      const elem1 = fromTaggedValue(stack[3]);
      const elem2 = fromTaggedValue(stack[4]);
      expect(elem1.value).toBe(1);
      expect(elem2.value).toBe(2);

      const elem3 = fromTaggedValue(stack[5]);
      expect(elem3.value).toBe(3);

      const link = fromTaggedValue(stack[6]);
      expect(link.tag).toBe(Tag.LINK);
      expect(link.value).toBe(5);

      const val2 = fromTaggedValue(stack[7]);
      expect(val2.value).toBe(4);
      expect(val2.tag).toBe(0);
    });
  });
});
