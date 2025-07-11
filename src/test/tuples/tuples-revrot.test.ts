import { describe, test, expect, beforeEach } from '@jest/globals';
import { parse } from '../../lang/parser';
import { Tokenizer } from '../../lang/tokenizer';
import { fromTaggedValue, Tag } from '../../core/tagged';
import { findElement as _findElement } from '../../stack/find';
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

describe('Tuple revrot operations', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.SP = 0;
    vm.RP = 0;
    vm.BP = 0;
    vm.IP = 0;
    vm.tupleDepth = 0;
    vm.compiler.reset();
  });

  describe('revrot', () => {
    test('should reverse rotate three simple values', () => {
      // Push the values first
      executeCode('1 2 3 revrot');

      const stack = vm.getStackData();

      // After reverse rotate: 3 1 2
      expect(stack.length).toBe(3);

      // Check each value using fromTaggedValue
      const val1 = fromTaggedValue(stack[0]);
      const val2 = fromTaggedValue(stack[1]);
      const val3 = fromTaggedValue(stack[2]);

      expect(val1.value).toBe(3);
      expect(val2.value).toBe(1);
      expect(val3.value).toBe(2);
    });

    test('should reverse rotate a tuple with two simple values', () => {
      // Push the values first
      executeCode('(1 2) 3 4');

      // Execute the revrot operation
      executeCode('revrot');

      // Get the stack after rotation
      const stack = vm.getStackData();

      // After revrot: 4 (1 2) 3
      // Stack should have: [4, TUPLE_HEADER, 1, 2, LINK, 3]
      expect(stack.length).toBe(6);

      // The first element after rotation should be 4
      const val1 = fromTaggedValue(stack[0]);
      expect(val1.value).toBe(4);

      // The second element should be the tuple header
      const tupleTag = fromTaggedValue(stack[1]);
      expect(tupleTag.tag).toBe(Tag.TUPLE);
      expect(tupleTag.value).toBe(2);  // Tuple size should be 2

      // Check the tuple elements (1 and 2)
      const elem1 = fromTaggedValue(stack[2]);
      const elem2 = fromTaggedValue(stack[3]);
      expect(elem1.value).toBe(1);
      expect(elem2.value).toBe(2);

      // Check the LINK tag
      const linkTag = fromTaggedValue(stack[4]);
      expect(linkTag.tag).toBe(Tag.LINK);
      // The LINK value should point to the start of the tuple (index 1)
      expect(linkTag.value).toBe(3);

      // Check the last value (3)
      const val3 = fromTaggedValue(stack[5]);
      expect(val3.value).toBe(3);
    });

   test('should handle nested tuples', () => {
      executeCode('((1 2) 3) 4 5 revrot');
      const stack = vm.getStackData();

      // After revrot: 5 4 NaN TUPLE(2) 1 2 3 LINK(5)
      // The first two elements are the numbers we expect
      expect(stack[0]).toBe(5);

      // The third element is a marker (NaN in this case)
      expect(Number.isNaN(stack[1])).toBe(true);

      // The fourth element is the TUPLE header
      const tupleTag = fromTaggedValue(stack[1]);
      expect(tupleTag).toEqual({ tag: Tag.TUPLE, value: 2 });

      // The tuple's first element is 1
      expect(stack[4]).toBe(1);

      // The tuple's second element is 2
      expect(stack[5]).toBe(2);

      // The third element in the tuple is 3
      expect(stack[6]).toBe(3);

      // The LINK points back to the start of the tuple (5 slots back from the end)
      const link = fromTaggedValue(stack[7]);
      expect(link).toEqual({ tag: Tag.LINK, value: 5 });

      // Verify the stack size is as expected
      expect(stack.length).toBe(8);
    });
   });
});
