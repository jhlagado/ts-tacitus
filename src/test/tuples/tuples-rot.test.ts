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

describe('Tuple rot operations', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.SP = 0;
    vm.RP = 0;
    vm.BP = 0;
    vm.IP = 0;
    vm.tupleDepth = 0;
    vm.compiler.reset();
  });

  describe('rot', () => {
    test('should rotate three simple values', () => {
      executeCode('1 2 3 rot');
      const stack = vm.getStackData();
      
      // After rot: 2 3 1
      expect(stack.length).toBe(3);
      expect(stack[0]).toBe(2);
      expect(stack[1]).toBe(3);
      expect(stack[2]).toBe(1);
    });

    test('should rotate a tuple with two simple values', () => {
      executeCode('(1 2) 3 4 rot');
      const stack = vm.getStackData();
      
      // After rot: 3 4 (1 2)
      expect(stack.length).toBe(4); // TUPLE(2) 1 2 LINK(3)
      expect(stack[0]).toBe(3);
      expect(stack[1]).toBe(4);
      // The tuple should be the third item
      expect(fromTaggedValue(stack[2])).toEqual({ tag: Tag.TUPLE, value: 2 });
      expect(stack[3]).toBe(1);
      expect(stack[4]).toBe(2);
      expect(fromTaggedValue(stack[5])).toEqual({ tag: Tag.LINK, value: 3 });
    });

    test('should rotate three tuples', () => {
      executeCode('(1 2) (3 4) (5 6) rot');
      const stack = vm.getStackData();
      
      // After rot: (3 4) (5 6) (1 2)
      // First tuple (3 4)
      expect(fromTaggedValue(stack[0])).toEqual({ tag: Tag.TUPLE, value: 2 });
      expect(stack[1]).toBe(3);
      expect(stack[2]).toBe(4);
      expect(fromTaggedValue(stack[3])).toEqual({ tag: Tag.LINK, value: 3 });
      
      // Second tuple (5 6)
      expect(fromTaggedValue(stack[4])).toEqual({ tag: Tag.TUPLE, value: 2 });
      expect(stack[5]).toBe(5);
      expect(stack[6]).toBe(6);
      expect(fromTaggedValue(stack[7])).toEqual({ tag: Tag.LINK, value: 3 });
      
      // Third tuple (1 2)
      expect(fromTaggedValue(stack[8])).toEqual({ tag: Tag.TUPLE, value: 2 });
      expect(stack[9]).toBe(1);
      expect(stack[10]).toBe(2);
      expect(fromTaggedValue(stack[11])).toEqual({ tag: Tag.LINK, value: 3 });
    });

    test('should handle nested tuples', () => {
      executeCode('((1 2) 3) 4 5 rot');
      const stack = vm.getStackData();
      
      // After rot: 4 5 ((1 2) 3)
      expect(stack[0]).toBe(4);
      expect(stack[1]).toBe(5);
      
      // The nested tuple ((1 2) 3)
      expect(fromTaggedValue(stack[2])).toEqual({ tag: Tag.TUPLE, value: 2 });
      
      // Inner tuple (1 2)
      expect(fromTaggedValue(stack[3])).toEqual({ tag: Tag.TUPLE, value: 2 });
      expect(stack[4]).toBe(1);
      expect(stack[5]).toBe(2);
      expect(fromTaggedValue(stack[6])).toEqual({ tag: Tag.LINK, value: 3 });
      
      // The rest of the outer tuple
      expect(stack[7]).toBe(3);
      expect(fromTaggedValue(stack[8])).toEqual({ tag: Tag.LINK, value: 7 }); // Points to the TUPLE(2) at index 3
    });
  });
});
