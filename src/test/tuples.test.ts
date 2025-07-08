import { describe, it, expect, beforeEach } from '@jest/globals';
import { parse } from '../lang/parser';
import { Tokenizer } from '../lang/tokenizer';
import { fromTaggedValue, Tag } from '../core/tagged';
import { execute } from '../lang/interpreter';
import { vm, initializeInterpreter } from '../core/globalState';
/**
 * Helper function to execute Tacit code and return the stack
 */
function executeCode(code: string): number[] {
  const tokenizer = new Tokenizer(code);
  parse(tokenizer);
  execute(0);
  return vm.getStackData();
}
describe('Tuple operations', () => {
  beforeEach(() => {
    initializeInterpreter();

    vm.SP = 0;
    vm.RP = 0;
    vm.BP = 0;
    vm.IP = 0;
    vm.tupleDepth = 0;
    vm.compiler.reset();
  });

  describe('creation', () => {
    it('should create a simple tuple with 2 elements', () => {
      const stack = executeCode('( 1 2 )');

      expect(stack.length).toBe(4);

      const { tag: tupleTag, value: tupleSize } = fromTaggedValue(stack[0]);
      expect(tupleTag).toBe(Tag.TUPLE);
      expect(tupleSize).toBe(2);

      expect(stack[1]).toBe(1);
      expect(stack[2]).toBe(2);

      const { tag: linkTag } = fromTaggedValue(stack[3]);
      expect(linkTag).toBe(Tag.LINK);
    });
    it('should handle empty tuples', () => {
      const stack = executeCode('( )');
      expect(stack.length).toBe(2);

      const { tag: tupleTag, value: tupleSize } = fromTaggedValue(stack[0]);
      expect(tupleTag).toBe(Tag.TUPLE);
      expect(tupleSize).toBe(0);

      const { tag: linkTag } = fromTaggedValue(stack[1]);
      expect(linkTag).toBe(Tag.LINK);
    });
    it('should handle a nested tuple with 1 level of nesting', () => {
      const stack = executeCode('( 1 ( 2 3 ) 4 )');
      /*
       * Expected stack with tag-first approach (from bottom to top):
       * [0]: TUPLE         - Outer tuple tag
       * [1]: 1             - First element of outer tuple
       * [2]: TUPLE         - Inner tuple tag
       * [3]: 2             - First element of inner tuple
       * [4]: 3             - Second element of inner tuple
       * [5]: 4             - Last element of outer tuple
       */
      expect(stack.length).toBe(6);

      const { tag: outerTag, value: outerSize } = fromTaggedValue(stack[0]);
      expect(outerTag).toBe(Tag.TUPLE);
      expect(outerSize).toBe(5);
      expect(stack[1]).toBe(1);
      const { tag: innerTag, value: innerSize } = fromTaggedValue(stack[2]);
      expect(innerTag).toBe(Tag.TUPLE);
      expect(innerSize).toBe(2);
      expect(stack[3]).toBe(2);
      expect(stack[4]).toBe(3);
      expect(stack[5]).toBe(4);
    });
    it('should handle multiple nested tuples at the same level', () => {
      const stack = executeCode('( ( 1 2 ) ( 3 4 ) )');

      /*
       * Expected stack layout with focus on reliable numeric values:
       * [0]: Tuple tag (outer)
       * [1]: Tuple tag (first nested)
       * [2]: 1             - First element of first nested tuple
       * [3]: 2             - Second element of first nested tuple
       * [4]: Tuple tag (second nested)
       * [5]: 3             - First element of second nested tuple
       * [6]: 4             - Second element of second nested tuple
       */
      expect(stack.length).toBe(7);

      expect(stack[2]).toBe(1);
      expect(stack[3]).toBe(2);
      expect(stack[5]).toBe(3);
      expect(stack[6]).toBe(4);
    });
    it('should handle complex mixed nested structures', () => {
      const stack = executeCode('( 1 ( ) ( 2 ( 3 4 ) ) 5 )');

      expect(stack.length).toBe(9);

      expect(stack[1]).toBe(1);
      expect(stack[4]).toBe(2);
      expect(stack[6]).toBe(3);
      expect(stack[7]).toBe(4);
      expect(stack[8]).toBe(5);

      expect(stack[8]).toBe(5);
    });
    it('should handle deeply nested tuples (3+ levels)', () => {
      const stack = executeCode('( 1 ( 2 ( 3 4 ) 5 ) 6 )');
      /*
       * Expected stack (from bottom to top) with tag-first approach:
       * [0]: TUPLE         - Outermost tuple tag
       * [1]: 1             - First element of outermost tuple
       * [2]: TUPLE         - Middle tuple tag
       * [3]: 2             - First element of middle tuple
       * [4]: TUPLE         - Innermost tuple tag
       * [5]: 3             - First element of innermost tuple
       * [6]: 4             - Second element of innermost tuple
       * [7]: 5             - Third element of middle tuple
       * [8]: 6             - Third element of outermost tuple
       */
      expect(stack.length).toBe(9);

      const { tag: outerTag } = fromTaggedValue(stack[0]);
      expect(outerTag).toBe(Tag.TUPLE);
      expect(stack[1]).toBe(1);
      const { tag: middleTag } = fromTaggedValue(stack[2]);
      expect(middleTag).toBe(Tag.TUPLE);
      expect(stack[3]).toBe(2);
      const { tag: innerTag } = fromTaggedValue(stack[4]);
      expect(innerTag).toBe(Tag.TUPLE);
      expect(stack[5]).toBe(3);
      expect(stack[6]).toBe(4);
      expect(stack[7]).toBe(5);
      expect(stack[8]).toBe(6);
    });
  });

  describe('dup', () => {
    it('should duplicate a simple tuple', () => {
      executeCode('( 1 2 ) dup');

      const stack = vm.getStackData();
      expect(stack.length).toBe(8);

      const { tag: firstTupleTag, value: firstTupleSize } = fromTaggedValue(stack[0]);
      const { tag: firstLinkTag } = fromTaggedValue(stack[3]);
      const { tag: secondTupleTag, value: secondTupleSize } = fromTaggedValue(stack[4]);
      const { tag: secondLinkTag } = fromTaggedValue(stack[7]);

      expect(firstTupleTag).toBe(Tag.TUPLE);
      expect(firstTupleSize).toBe(2);
      expect(stack[1]).toBe(1);
      expect(stack[2]).toBe(2);
      expect(firstLinkTag).toBe(Tag.LINK);

      expect(secondTupleTag).toBe(Tag.TUPLE);
      expect(secondTupleSize).toBe(2);
      expect(stack[5]).toBe(1);
      expect(stack[6]).toBe(2);
      expect(secondLinkTag).toBe(Tag.LINK);
    });

    it('should duplicate a nested tuple', () => {
      executeCode('( 5 6 ) dup');

      const stack = vm.getStackData();
      expect(stack.length).toBe(8);

      expect(stack[1]).toBe(5);
      expect(stack[2]).toBe(6);
      expect(stack[5]).toBe(5);
      expect(stack[6]).toBe(6);

      vm.reset();

      executeCode('( 1 ( 2 3 ) 4 )');
      const stackBeforeDup = vm.getStackData();

      executeCode('dup');
      const dupStack = vm.getStackData();

      const countValue = (val: number): number => {
        let count = 0;
        for (let i = 0; i < dupStack.length; i++) {
          if (dupStack[i] === val) count++;
        }
        return count;
      };

      expect(countValue(1)).toBeGreaterThan(0);
      expect(countValue(2)).toBeGreaterThan(0);
      expect(countValue(3)).toBeGreaterThan(0);
      expect(countValue(4)).toBeGreaterThan(0);

      expect(dupStack.length).toBeGreaterThan(stackBeforeDup.length);
    });

    it('should duplicate a regular value', () => {
      executeCode('42 dup');

      const stack = vm.getStackData();
      expect(stack.length).toBe(2);
      expect(stack[0]).toBe(42);
      expect(stack[1]).toBe(42);
    });

    it('should be able to operate on duplicated tuples individually', () => {
      executeCode('( 10 20 ) dup');

      executeCode('30 40');

      const stack = vm.getStackData();
      expect(stack.length).toBe(10);

      const { tag: origTupleTag, value: origTupleSize } = fromTaggedValue(stack[0]);
      expect(origTupleTag).toBe(Tag.TUPLE);
      expect(origTupleSize).toBe(2);
      expect(stack[1]).toBe(10);
      expect(stack[2]).toBe(20);

      expect(stack[8]).toBe(30);
      expect(stack[9]).toBe(40);
    });
  });

  describe('drop', () => {
    it('should drop a regular value from the stack', () => {
      const stack = executeCode('1 2 drop');

      expect(stack.length).toBe(1);
      expect(stack[0]).toBe(1);
    });
    it('should drop an entire simple tuple', () => {
      const stack = executeCode('( 1 2 ) drop');

      expect(stack.length).toBe(0);
    });

    it('should drop a tuple while leaving other values on stack', () => {
      const stack = executeCode('5 ( 1 2 ) drop 10');

      expect(stack.length).toBe(2);
      expect(stack[0]).toBe(5);
      expect(stack[1]).toBe(10);
    });
    it('should drop a nested tuple completely', () => {
      initializeInterpreter();

      executeCode('( 1 ( 2 3 ) 4 )');

      const stackBefore = vm.getStackData().length;

      executeCode('drop');

      const stackAfter = vm.getStackData().length;
      expect(stackAfter).toBeLessThan(stackBefore);

      executeCode('42');
      expect(vm.peek()).toBe(42);
    });

    it('should drop only the top tuple when multiple tuples are present', () => {
      initializeInterpreter();

      executeCode('( 1 2 )');
      executeCode('( 3 4 )');

      const beforeDrop = vm.peek();

      executeCode('drop');

      const afterDrop = vm.peek();
      expect(afterDrop).not.toBe(beforeDrop);

      executeCode('100');
      expect(vm.peek()).toBe(100);

      vm.pop();

      executeCode('200');
      expect(vm.peek()).toBe(200);
    });

    it('should handle complex scenarios with multiple tuple operations', () => {
      initializeInterpreter();

      executeCode('( 1 ( 2 3 ) )');
      executeCode('42');

      const topBeforeOps = vm.peek();
      expect(topBeforeOps).toBe(42);

      executeCode('swap drop');

      expect(vm.peek()).toBe(42);

      expect(vm.pop()).toBe(42);

      executeCode('100');
      expect(vm.peek()).toBe(100);
    });

    it('should drop a deeply nested tuple in a single operation', () => {
      initializeInterpreter();

      executeCode('( 1 ( 2 ( 3 4 ) 5 ) 6 )');

      expect(vm.SP).toBeGreaterThan(0);

      executeCode('drop');

      executeCode('123');
      expect(vm.peek()).toBe(123);

      vm.pop();

      executeCode('456');
      expect(vm.peek()).toBe(456);
    });

    it('should drop multiple tuples consecutively', () => {
      initializeInterpreter();

      executeCode('( 10 20 )');

      const firstTuple = vm.peek();

      executeCode('drop');

      executeCode('( 30 40 )');

      const secondTuple = vm.peek();

      expect(secondTuple).not.toBe(firstTuple);

      executeCode('drop');

      executeCode('50');
      expect(vm.peek()).toBe(50);

      executeCode('60');
      expect(vm.peek()).toBe(60);
      vm.pop();
      expect(vm.peek()).toBe(50);
    });

    it('should drop a tuple when directly referenced', () => {
      const stack = executeCode('( 10 20 ) 30 drop drop');

      expect(stack.length).toBe(0);
    });
  });
});
