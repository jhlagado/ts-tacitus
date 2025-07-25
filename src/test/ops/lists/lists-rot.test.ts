import { describe, test, expect, beforeEach } from '@jest/globals';
import { parse } from '../../../lang/parser';
import { Tokenizer } from '../../../lang/tokenizer';
import { fromTaggedValue, Tag } from '../../../core/tagged';
import { findElement } from '../../../stack/find';
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

describe('List rot operations', () => {
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

      for (let i = 0; i < vm.SP; i += 4) {
        const raw = vm.memory.readFloat32(0, i);
        const { tag, value } = fromTaggedValue(raw);
      }

      const [nextSlot, listSize] = findElement(vm, 0);
      for (let i = 0; i < listSize; i++) {
        const addr = i * 4;
        const raw = vm.memory.readFloat32(0, addr);
        const { tag, value } = fromTaggedValue(raw);
        console.log(`  [${addr}]: ${raw} (${Tag[tag]}: ${value})`);
      }

      executeCode('rot');

      const stack = vm.getStackData();

      for (let i = 0; i < vm.SP; i += 4) {
        const raw = vm.memory.readFloat32(0, i);
        const { tag, value } = fromTaggedValue(raw);
      }

      expect(stack.length).toBe(6);

      const val1 = fromTaggedValue(stack[0]);
      const val2 = fromTaggedValue(stack[1]);

      expect(val1.value).toBe(3);
      expect(val2.value).toBe(4);

      const listTag = fromTaggedValue(stack[2]);

      expect(listTag.tag).toBe(Tag.LIST);
      expect(listTag.value).toBe(2);

      const elem1 = fromTaggedValue(stack[3]);
      const elem2 = fromTaggedValue(stack[4]);

      expect(elem1.value).toBe(1);
      expect(elem2.value).toBe(2);

      const linkTag = fromTaggedValue(stack[5]);

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
