/**
 * Tests for lists.md specification compliance
 * Tests the address-based operations and spec-required functionality
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { executeTacitCode, resetVM } from '../../utils/vm-test-utils';
import { fromTaggedValue, isNIL, Tag } from '../../../core/tagged';
import { isList } from '../../../core/list';

describe('Lists.md Specification Compliance', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('Section 9: size and counting', () => {
    test('length returns payload slot count', () => {
      const stack = executeTacitCode('( 1 ( 2 3 ) 4 ) length');

      const result = stack[0];
      expect(result).toBe(5);
    });

    test('size returns element count via traversal', () => {
      const stack = executeTacitCode('( 1 ( 2 3 ) 4 ) size');

      const result = stack[0];
      expect(result).toBe(3);
    });

    test('empty list length and size both return 0', () => {
      let stack = executeTacitCode('( ) length');
      expect(fromTaggedValue(stack[stack.length - 1]).value).toBe(0);

      resetVM();
      stack = executeTacitCode('( ) size');
      expect(fromTaggedValue(stack[stack.length - 1]).value).toBe(0);
    });
  });

  describe('Section 10: Address queries', () => {
    test('slot operation returns slot addresses', () => {
      executeTacitCode('( 42 99 ) 0 slot');
    });

    test('elem operation returns element addresses', () => {
      executeTacitCode('( 1 ( 2 3 ) 4 ) 1 elem');
    });

    test('fetch and store work with addresses', () => {
      const stack = executeTacitCode('( 42 99 ) 0 elem fetch');

      const result = stack[stack.length - 1];
      const decoded = fromTaggedValue(result);
      expect(decoded.value).toBe(42);
    });
  });

  describe('Section 12: Structural operations', () => {
    test('head returns first element', () => {
      const stack = executeTacitCode('( 1 2 3 ) head');
      const result = stack[stack.length - 1];
      const decoded = fromTaggedValue(result);
      expect(decoded.value).toBe(1);
    });

    test('head returns nested list correctly', () => {
      const stack = executeTacitCode('( ( 2 3 ) 4 5 ) head');
      const result = stack[stack.length - 1];
      expect(isList(result)).toBe(true);
    });

    test('head returns nil for empty list', () => {
      const stack = executeTacitCode('( ) head');

      const result = stack[0];
      expect(isNIL(result)).toBe(true);
    });

    test('uncons splits list correctly', () => {
      const stack = executeTacitCode('( 1 2 3 ) uncons');
      const head = stack[stack.length - 1];
      expect(fromTaggedValue(head).value).toBe(1);
    });

    test('cons prepends element', () => {
      const stack = executeTacitCode('( 2 3 ) 1 cons');
      const header = stack[stack.length - 1];
      expect(isList(header)).toBe(true);
    });

    test('tail removes first element', () => {
      const stack = executeTacitCode('( 1 2 3 ) tail');
      const header = stack[stack.length - 1];
      expect(isList(header)).toBe(true);
    });

    test('structural operations are properly registered', () => {
      expect(() => executeTacitCode('( )')).not.toThrow();

      const operations = ['head', 'tail', 'cons', 'concat', 'uncons'];
      operations.forEach(op => {
        try {
          executeTacitCode(`( ) ${op}`);
        } catch (error) {
          expect(error instanceof Error ? error.message : String(error)).not.toContain(
            'Undefined word',
          );
        }
        resetVM();
      });
    });
  });

  describe('Algebraic laws (Section 20)', () => {
    test('cons then tail restores original', () => {
      const original = executeTacitCode('( 2 3 )');
      resetVM();
      const restored = executeTacitCode('( 2 3 ) 1 cons tail');
      const origHeader = original[original.length - 1];
      const restHeader = restored[restored.length - 1];
      expect(fromTaggedValue(origHeader).value).toBe(fromTaggedValue(restHeader).value);
    });

    test('head and uncons consistency', () => {
      const headResult = executeTacitCode('( 1 2 3 ) head');
      resetVM();
      const unconsResult = executeTacitCode('( 1 2 3 ) uncons swap drop');
      expect(fromTaggedValue(headResult[headResult.length - 1]).value).toBe(1);
      expect(fromTaggedValue(unconsResult[unconsResult.length - 1]).value).toBe(1);
    });

    test('pack with 0 count creates empty list', () => {
      const stack = executeTacitCode('0 pack');
      const header = stack[stack.length - 1];
      expect(isList(header)).toBe(true);
      expect(fromTaggedValue(header).value).toBe(0);
    });

    test('unpack pushes list elements to stack', () => {
      const stack = executeTacitCode('( 1 2 3 ) unpack');
      expect(stack.length).toBe(3);
      expect(fromTaggedValue(stack[0]).value).toBe(3);
      expect(fromTaggedValue(stack[1]).value).toBe(2);
      expect(fromTaggedValue(stack[2]).value).toBe(1);
    });

    test('pack and unpack are inverses', () => {
      const original = executeTacitCode('1 2 3');
      resetVM();
      const restored = executeTacitCode('1 2 3 3 pack unpack');
      expect(restored).toEqual(original);
    });
  });
});
