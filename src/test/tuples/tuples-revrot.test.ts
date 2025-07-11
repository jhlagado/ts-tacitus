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
      
      // After revrot: 5 [TUPLE(2) TUPLE(2) 1 2 3 LINK(5)] 4
      expect(stack.length).toBe(8);

      // First element is 5
      const val1 = fromTaggedValue(stack[0]);
      expect(val1.value).toBe(5);
      expect(val1.tag).toBe(0);  // 0 is Tag.NUMBER

      // Second element is the TUPLE header for outer tuple
      const outerTupleTag = fromTaggedValue(stack[1]);
      expect(outerTupleTag.tag).toBe(Tag.TUPLE);
      expect(outerTupleTag.value).toBe(2);  // Outer tuple has 2 elements

      // Third element is the TUPLE header for inner tuple
      const innerTupleTag = fromTaggedValue(stack[2]);
      expect(innerTupleTag.tag).toBe(Tag.TUPLE);
      expect(innerTupleTag.value).toBe(2);  // Inner tuple has 2 elements

      // Inner tuple elements (1 and 2)
      const elem1 = fromTaggedValue(stack[3]);
      const elem2 = fromTaggedValue(stack[4]);
      expect(elem1.value).toBe(1);
      expect(elem2.value).toBe(2);

      // The second element of outer tuple is 3
      const elem3 = fromTaggedValue(stack[5]);
      expect(elem3.value).toBe(3);

      // The LINK points back to the start of the outer tuple (5 slots back from the end)
      const link = fromTaggedValue(stack[6]);
      expect(link.tag).toBe(Tag.LINK);
      expect(link.value).toBe(5);

      // The last element is 4
      const val2 = fromTaggedValue(stack[7]);
      expect(val2.value).toBe(4);
      expect(val2.tag).toBe(0);  // 0 is Tag.NUMBER
    });
   });
});
