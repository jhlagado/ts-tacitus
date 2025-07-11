import { describe, test, expect, beforeEach } from '@jest/globals';
import { parse } from '../../lang/parser';
import { Tokenizer } from '../../lang/tokenizer';
import { fromTaggedValue, Tag } from '../../core/tagged';
import { findTuple } from '../../stack/find';
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
      // Push the values first
      executeCode('1 2 3 rot');

      const stack = vm.getStackData();

      // After rot: 2 3 1
      expect(stack.length).toBe(3);

      // Check each value using fromTaggedValue
      const val1 = fromTaggedValue(stack[0]);
      const val2 = fromTaggedValue(stack[1]);
      const val3 = fromTaggedValue(stack[2]);

      expect(val1.value).toBe(2);
      expect(val2.value).toBe(3);
      expect(val3.value).toBe(1);
    });

    test('should rotate a tuple with two simple values', () => {
      // Push the values first
      executeCode('(1 2) 3 4');

      // Log the initial stack state
      const initialStack = vm.getStackData();
      console.log('\n=== BEFORE ROTATION ===');
      console.log('Stack (formatted):', initialStack.map(x => {
        const { tag, value } = fromTaggedValue(x);
        return { tag: Tag[tag], value };
      }));

      // Log raw memory layout
      console.log('\nRaw memory layout (SP =', vm.SP, '):');
      for (let i = 0; i < vm.SP; i += 4) {
        const raw = vm.memory.readFloat32(0, i);
        const { tag, value } = fromTaggedValue(raw);
        console.log(`  [${i}]: ${raw} (${Tag[tag]}: ${value})`);
      }

      // Log the tuple structure
      const tupleInfo = findTuple(vm, 0);
      console.log('\nTuple info:', tupleInfo);
      if (tupleInfo) {
        console.log('Tuple data:');
        for (let i = 0; i < tupleInfo.totalSize; i += 4) {
          const raw = vm.memory.readFloat32(0, tupleInfo.start + i);
          const { tag, value } = fromTaggedValue(raw);
          console.log(`  [${tupleInfo.start + i}]: ${raw} (${Tag[tag]}: ${value})`);
        }
      }

      // Execute the rot operation
      executeCode('rot');

      // Log the stack state after rotation
      const stack = vm.getStackData();
      console.log('\n=== AFTER ROTATION ===');
      console.log('Stack (formatted):', stack.map(x => {
        const { tag, value } = fromTaggedValue(x);
        return { tag: Tag[tag], value };
      }));

      // Log raw memory layout after rotation
      console.log('\nRaw memory layout after rotation (SP =', vm.SP, '):');
      for (let i = 0; i < vm.SP; i += 4) {
        const raw = vm.memory.readFloat32(0, i);
        const { tag, value } = fromTaggedValue(raw);
        console.log(`  [${i}]: ${raw} (${Tag[tag]}: ${value})`);
      }

      // First check the stack length
      expect(stack.length).toBe(6);

      // Check the first two values (3 and 4)
      const val1 = fromTaggedValue(stack[0]);
      const val2 = fromTaggedValue(stack[1]);
      console.log('\nFirst value:', val1);
      console.log('Second value:', val2);

      expect(val1.value).toBe(3);
      expect(val2.value).toBe(4);

      // Check the tuple header at index 2
      const tupleTag = fromTaggedValue(stack[2]);
      console.log('\nTuple header:', tupleTag);

      // Check if it's a TUPLE tag with value 2
      expect(tupleTag.tag).toBe(Tag.TUPLE);
      expect(tupleTag.value).toBe(2);

      // Check the tuple elements (1 and 2)
      const elem1 = fromTaggedValue(stack[3]);
      const elem2 = fromTaggedValue(stack[4]);
      console.log('Tuple elements:', elem1, elem2);

      expect(elem1.value).toBe(1);
      expect(elem2.value).toBe(2);

      // Check the LINK tag
      const linkTag = fromTaggedValue(stack[5]);
      console.log('Link tag:', linkTag);

      expect(linkTag.tag).toBe(Tag.LINK);
      expect(linkTag.value).toBe(3);
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

    xtest('should handle nested tuples', () => {
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
