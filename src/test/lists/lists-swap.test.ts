import { describe, test, expect, beforeEach } from '@jest/globals';
import { parse } from '../../lang/parser';
import { Tokenizer } from '../../lang/tokenizer';
import { fromTaggedValue, Tag } from '../../core/tagged';
import { execute } from '../../lang/interpreter';

import { vm, initializeInterpreter } from '../../core/globalState';
import { findElement } from '../../stack/find';

/**
 * Helper function to execute Tacit code and return the stack
 */
function executeCode(code: string): number[] {
  const tokenizer = new Tokenizer(code);
  parse(tokenizer);
  execute(0);
  return vm.getStackData();
}

describe('List swap operations', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.SP = 0;
    vm.RP = 0;
    vm.BP = 0;
    vm.IP = 0;
    vm.listDepth = 0;
    vm.running = true;
    vm.compiler.reset();
  });

  describe('swap', () => {
    test('should swap two simple values', () => {
      executeCode('10 20 swap');
      const stack = vm.getStackData();

      /**
       * Expected stack layout after 10 20 swap:
       * [0] 20        - Original second value, now first
       * [1] 10        - Original first value, now second
       */
      expect(stack.length).toBe(2);
      expect(stack[0]).toBe(20);
      expect(stack[1]).toBe(10);
    });

    test('should swap a simple list with a value', () => {
      executeCode('( 20 30 ) 10');

      const initialStack = vm.getStackData();
      console.log('\n=== BEFORE SWAP ===');
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
      console.log('\nList info:', { nextSlot, listSize });
      console.log('List data:');
      for (let i = 0; i < listSize; i++) {
        const addr = i * 4;
        const raw = vm.memory.readFloat32(0, addr);
        const { tag, value } = fromTaggedValue(raw);
        console.log(`  [${addr}]: ${raw} (${Tag[tag]}: ${value})`);
      }

      executeCode('swap');

      const stack = vm.getStackData();
      console.log('\n=== AFTER SWAP ===');
      console.log(
        'Stack (formatted):',
        stack.map(x => {
          const { tag, value } = fromTaggedValue(x);
          return { tag: Tag[tag], value };
        }),
      );

      console.log('\nRaw memory layout after swap (SP =', vm.SP, '):');
      for (let i = 0; i < vm.SP; i += 4) {
        const raw = vm.memory.readFloat32(0, i);
        const { tag, value } = fromTaggedValue(raw);
        console.log(`  [${i}]: ${raw} (${Tag[tag]}: ${value})`);
      }

      expect(stack.length).toBe(5);

      const swappedValue = fromTaggedValue(stack[0]);
      console.log('Swapped value:', swappedValue);
      expect(swappedValue.value).toBe(10);

      const listHeader = fromTaggedValue(stack[1]);
      console.log('\nList header:', listHeader);
      expect(listHeader.tag).toBe(Tag.LIST);
      expect(listHeader.value).toBe(2);

      const elem1 = fromTaggedValue(stack[2]);
      const elem2 = fromTaggedValue(stack[3]);
      console.log('List elements:', elem1, elem2);
      expect(elem1.value).toBe(20);
      expect(elem2.value).toBe(30);

      const linkTag = fromTaggedValue(stack[4]);
      console.log('Link tag:', linkTag);
      expect(linkTag.tag).toBe(Tag.LINK);
      expect(linkTag.value).toBe(3);
    });

    test('should swap a value with a simple list', () => {
      executeCode('( 20 30 ) 10');

      const initialStack = vm.getStackData();
      console.log('\n=== BEFORE SWAP ===\n');
      console.log(
        'Stack (formatted):',
        initialStack.map(v => fromTaggedValue(v)),
      );

      executeCode('swap');

      const stack = vm.getStackData();
      console.log('\n=== AFTER SWAP ===\n');
      console.log(
        'Stack (formatted):',
        stack.map(v => fromTaggedValue(v)),
      );

      expect(stack.length).toBe(5);

      const swappedValue = fromTaggedValue(stack[0]);
      console.log('Swapped value:', swappedValue);
      expect(swappedValue.tag).toBe(Tag.NUMBER);
      expect(swappedValue.value).toBe(10);

      const { tag: listTag, value: listSize } = fromTaggedValue(stack[1]);
      console.log('\nList header:', { value: listSize, tag: listTag });
      expect(listTag).toBe(Tag.LIST);
      expect(listSize).toBe(2);
      expect(stack[2]).toBe(20);
      expect(stack[3]).toBe(30);

      const { tag: linkTag } = fromTaggedValue(stack[4]);
      expect(linkTag).toBe(Tag.LINK);
    });

    test('should swap two simple lists', () => {
      executeCode('( 10 20 ) ( 30 40 )');

      const initialStack = vm.getStackData();
      console.log('\n=== BEFORE SWAP ===\n');
      console.log(
        'Stack (formatted):',
        initialStack.map(v => fromTaggedValue(v)),
      );

      executeCode('swap');

      const stack = vm.getStackData();
      console.log('\n=== AFTER SWAP ===\n');
      console.log(
        'Stack (formatted):',
        stack.map(v => fromTaggedValue(v)),
      );

      expect(stack.length).toBe(8);

      const firstList = fromTaggedValue(stack[0]);
      console.log('\nFirst list header:', firstList);
      expect(firstList.tag).toBe(Tag.LIST);
      expect(firstList.value).toBe(2);

      console.log('First list elements:', fromTaggedValue(stack[1]), fromTaggedValue(stack[2]));
      expect(stack[1]).toBe(30);
      expect(stack[2]).toBe(40);

      const firstLink = fromTaggedValue(stack[3]);
      console.log('First link tag:', firstLink);
      expect(firstLink.tag).toBe(Tag.LINK);

      const secondList = fromTaggedValue(stack[4]);
      console.log('\nSecond list header:', secondList);
      expect(secondList.tag).toBe(Tag.LIST);
      expect(secondList.value).toBe(2);

      console.log('Second list elements:', fromTaggedValue(stack[5]), fromTaggedValue(stack[6]));
      expect(stack[5]).toBe(10);
      expect(stack[6]).toBe(20);

      const secondLink = fromTaggedValue(stack[7]);
      console.log('Second link tag:', secondLink);
      expect(secondLink.tag).toBe(Tag.LINK);
    });

    test('should swap a nested list with a value', () => {
      executeCode('42 ( 10 ( 20 30 ) 40 )');

      const initialStack = vm.getStackData();
      console.log('\n=== BEFORE SWAP ===\n');
      console.log(
        'Stack (formatted):',
        initialStack.map(v => fromTaggedValue(v)),
      );

      executeCode('swap');

      const stack = vm.getStackData();
      console.log('\n=== AFTER SWAP ===\n');
      console.log(
        'Stack (formatted):',
        stack.map(v => fromTaggedValue(v)),
      );

      expect(stack.length).toBe(8);

      const outerList = fromTaggedValue(stack[0]);
      console.log('\nOuter list header:', outerList);
      expect(outerList.tag).toBe(Tag.LIST);
      expect(outerList.value).toBe(5);

      const swappedValue = fromTaggedValue(stack[7]);
      console.log('Swapped value:', swappedValue);
      expect(swappedValue.tag).toBe(Tag.NUMBER);
      expect(swappedValue.value).toBe(42);

      let innerListIndex = -1;
      for (let i = 0; i < stack.length; i++) {
        const { tag, value } = fromTaggedValue(stack[i]);
        if (tag === Tag.LIST && i > 0) {
          innerListIndex = i;
          break;
        }
      }

      expect(innerListIndex).toBe(2);
      const innerList = fromTaggedValue(stack[innerListIndex]);
      console.log('Inner list at index', innerListIndex, ':', innerList);
      expect(innerList.tag).toBe(Tag.LIST);
      expect(innerList.value).toBe(2);

      expect(stack[1]).toBe(10);
      expect(stack[5]).toBe(40);

      const linkTag = fromTaggedValue(stack[6]);
      console.log('Link tag:', linkTag);
      expect(linkTag.tag).toBe(Tag.LINK);
    });

    test('should swap two nested lists correctly', () => {
      executeCode('( 1 ( 2 3 ) 4 ) ( 5 ( 6 7 ) 8 )');

      const initialStack = vm.getStackData();
      console.log('\n=== BEFORE SWAP ===\n');
      console.log(
        'Stack (formatted):',
        initialStack.map(v => fromTaggedValue(v)),
      );

      executeCode('swap');

      const stack = vm.getStackData();
      console.log('\n=== AFTER SWAP ===\n');
      console.log(
        'Stack (formatted):',
        stack.map(v => fromTaggedValue(v)),
      );

      expect(stack.length).toBe(14);

      const firstList = fromTaggedValue(stack[0]);
      console.log('\nFirst list header:', firstList);
      expect(firstList.tag).toBe(Tag.LIST);
      expect(firstList.value).toBe(5);

      console.log(
        'First list elements:',
        fromTaggedValue(stack[1]),
        fromTaggedValue(stack[2]),
        fromTaggedValue(stack[3]),
        fromTaggedValue(stack[4]),
        fromTaggedValue(stack[5]),
      );
      expect(stack[1]).toBe(5);

      const firstInnerList = fromTaggedValue(stack[2]);
      expect(firstInnerList.tag).toBe(Tag.LIST);
      expect(firstInnerList.value).toBe(2);
      expect(stack[3]).toBe(6);
      expect(stack[4]).toBe(7);

      const firstLink = fromTaggedValue(stack[6]);
      console.log('First link tag:', firstLink);
      expect(firstLink.tag).toBe(Tag.LINK);

      const secondList = fromTaggedValue(stack[7]);
      console.log('\nSecond list header:', secondList);
      expect(secondList.tag).toBe(Tag.LIST);
      expect(secondList.value).toBe(5);

      console.log(
        'Second list elements:',
        fromTaggedValue(stack[8]),
        fromTaggedValue(stack[9]),
        fromTaggedValue(stack[10]),
        fromTaggedValue(stack[11]),
        fromTaggedValue(stack[12]),
      );
      expect(stack[8]).toBe(1);

      const secondInnerList = fromTaggedValue(stack[9]);
      expect(secondInnerList.tag).toBe(Tag.LIST);
      expect(secondInnerList.value).toBe(2);
      expect(stack[10]).toBe(2);
      expect(stack[11]).toBe(3);

      const secondLink = fromTaggedValue(stack[13]);
      console.log('Second link tag:', secondLink);
      expect(secondLink.tag).toBe(Tag.LINK);

      expect(stack.indexOf(5)).toBeLessThan(stack.indexOf(1));
    });

    test('should handle empty lists during swap', () => {
      executeCode('( ) 42 swap');
      const stack = vm.getStackData();

      /**
       * Expected stack layout after ( ) 42 swap:
       * [0] 42        - Regular value
       * [1] LIST(0)  - Empty list tag
       * [2] LINK(1)   - Link tag (points back 1 element)
       */
      expect(stack.length).toBe(3);
      expect(stack[0]).toBe(42);

      const { tag: listTag, value: listSize } = fromTaggedValue(stack[1]);
      expect(listTag).toBe(Tag.LIST);
      expect(listSize).toBe(0);

      const { tag: linkTag } = fromTaggedValue(stack[2]);
      expect(linkTag).toBe(Tag.LINK);
    });

    test('should throw error when trying to swap with insufficient items', () => {
      executeCode('42');

      expect(() => {
        executeCode('swap');
      }).toThrow(/Stack underflow/);
    });
  });
});
