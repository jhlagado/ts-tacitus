import { describe, test, expect, beforeEach } from '@jest/globals';
import { parse } from '../../lang/parser';
import { Tokenizer } from '../../lang/tokenizer';
import { fromTaggedValue, Tag } from '../../core/tagged';
import { findElement } from '../../stack/find';
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
      const [nextSlot, tupleSize] = findElement(vm, 0);
      console.log('\nTuple info:', { nextSlot, tupleSize });
      console.log('Tuple data:');
      for (let i = 0; i < tupleSize; i++) {
        const addr = i * 4; // Convert slot to byte offset
        const raw = vm.memory.readFloat32(0, addr);
        const { tag, value } = fromTaggedValue(raw);
        console.log(`  [${addr}]: ${raw} (${Tag[tag]}: ${value})`);
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

    test('should handle nested tuples', () => {
      executeCode('((1 2) 3) 4 5 rot');
      const stack = vm.getStackData();

      // After rot: 4 5 NaN TUPLE(2) 1 2 3 LINK(5)
      // The first two elements are the numbers we expect
      expect(stack[0]).toBe(4);
      expect(stack[1]).toBe(5);

      // The third element is a marker (NaN in this case)
      expect(Number.isNaN(stack[2])).toBe(true);

      // The fourth element is the TUPLE header
      const tupleTag = fromTaggedValue(stack[3]);
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
