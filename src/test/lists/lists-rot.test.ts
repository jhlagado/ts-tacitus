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
    vm.listDepth = 0;
    vm.compiler.reset();
  });

  describe('rot', () => {
    test('should rotate three simple values', () => {
      executeCode('1 2 3 rot');

      const stack = vm.getStackData();

      expect(stack.length).toBe(3);

      const val1 = fromTaggedValue(stack[0]);
      const val2 = fromTaggedValue(stack[1]);
      const val3 = fromTaggedValue(stack[2]);

      expect(val1.value).toBe(2);
      expect(val2.value).toBe(3);
      expect(val3.value).toBe(1);
    });

    test('should rotate a list with two simple values', () => {
      executeCode('(1 2) 3 4');

      const initialStack = vm.getStackData();
      console.log('\n=== BEFORE ROTATION ===');
      console.log(
        'Stack (formatted):',
        initialStack.map(x => {
          const { tag, value } = fromTaggedValue(x);
          return { tag: Tag[tag], value };
        }),
      );

      console.log('\nRaw memory layout (SP =', vm.SP, '):');
      for (let i = 0; i < vm.SP; i += 4) {
        const raw = vm.memory.readFloat32(0, i);
        const { tag, value } = fromTaggedValue(raw);
        console.log(`  [${i}]: ${raw} (${Tag[tag]}: ${value})`);
      }

      const [nextSlot, listSize] = findElement(vm, 0);
      console.log('\nTuple info:', { nextSlot, listSize });
      console.log('Tuple data:');
      for (let i = 0; i < listSize; i++) {
        const addr = i * 4;
        const raw = vm.memory.readFloat32(0, addr);
        const { tag, value } = fromTaggedValue(raw);
        console.log(`  [${addr}]: ${raw} (${Tag[tag]}: ${value})`);
      }

      executeCode('rot');

      const stack = vm.getStackData();
      console.log('\n=== AFTER ROTATION ===');
      console.log(
        'Stack (formatted):',
        stack.map(x => {
          const { tag, value } = fromTaggedValue(x);
          return { tag: Tag[tag], value };
        }),
      );

      console.log('\nRaw memory layout after rotation (SP =', vm.SP, '):');
      for (let i = 0; i < vm.SP; i += 4) {
        const raw = vm.memory.readFloat32(0, i);
        const { tag, value } = fromTaggedValue(raw);
        console.log(`  [${i}]: ${raw} (${Tag[tag]}: ${value})`);
      }

      expect(stack.length).toBe(6);

      const val1 = fromTaggedValue(stack[0]);
      const val2 = fromTaggedValue(stack[1]);
      console.log('\nFirst value:', val1);
      console.log('Second value:', val2);

      expect(val1.value).toBe(3);
      expect(val2.value).toBe(4);

      const listTag = fromTaggedValue(stack[2]);
      console.log('\nTuple header:', listTag);

      expect(listTag.tag).toBe(Tag.LIST);
      expect(listTag.value).toBe(2);

      const elem1 = fromTaggedValue(stack[3]);
      const elem2 = fromTaggedValue(stack[4]);
      console.log('Tuple elements:', elem1, elem2);

      expect(elem1.value).toBe(1);
      expect(elem2.value).toBe(2);

      const linkTag = fromTaggedValue(stack[5]);
      console.log('Link tag:', linkTag);

      expect(linkTag.tag).toBe(Tag.LINK);
      expect(linkTag.value).toBe(3);
    });

    test('should rotate three lists', () => {
      executeCode('(1 2) (3 4) (5 6) rot');
      const stack = vm.getStackData();

      expect(fromTaggedValue(stack[0])).toEqual({ tag: Tag.LIST, value: 2 });
      expect(stack[1]).toBe(3);
      expect(stack[2]).toBe(4);
      expect(fromTaggedValue(stack[3])).toEqual({ tag: Tag.LINK, value: 3 });

      expect(fromTaggedValue(stack[4])).toEqual({ tag: Tag.LIST, value: 2 });
      expect(stack[5]).toBe(5);
      expect(stack[6]).toBe(6);
      expect(fromTaggedValue(stack[7])).toEqual({ tag: Tag.LINK, value: 3 });

      expect(fromTaggedValue(stack[8])).toEqual({ tag: Tag.LIST, value: 2 });
      expect(stack[9]).toBe(1);
      expect(stack[10]).toBe(2);
      expect(fromTaggedValue(stack[11])).toEqual({ tag: Tag.LINK, value: 3 });
    });

    test('should handle nested lists', () => {
      executeCode('((1 2) 3) 4 5 rot');
      const stack = vm.getStackData();

      expect(stack[0]).toBe(4);
      expect(stack[1]).toBe(5);

      expect(Number.isNaN(stack[2])).toBe(true);

      const listTag = fromTaggedValue(stack[3]);
      expect(listTag).toEqual({ tag: Tag.LIST, value: 2 });

      expect(stack[4]).toBe(1);

      expect(stack[5]).toBe(2);

      expect(stack[6]).toBe(3);

      const link = fromTaggedValue(stack[7]);
      expect(link).toEqual({ tag: Tag.LINK, value: 5 });

      expect(stack.length).toBe(8);
    });
  });
});
