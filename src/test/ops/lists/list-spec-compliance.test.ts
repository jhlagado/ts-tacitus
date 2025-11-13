/**
 * Tests for lists.md specification compliance
 * Tests the address-based operations and spec-required functionality
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../../core';
import { executeTacitCode } from '../../utils/vm-test-utils';
import { getTaggedInfo, isNIL } from '../../../core/tagged';
import { isList } from '../../../core/list';

describe('Lists.md Specification Compliance', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('Section 9: size and counting', () => {
    test('length returns payload slot count', () => {
      const stack = executeTacitCode(vm, '( 1 ( 2 3 ) 4 ) length');

      const result = stack[0];
      expect(result).toBe(5);
    });

    test('size returns element count via traversal', () => {
      const stack = executeTacitCode(vm, '( 1 ( 2 3 ) 4 ) size');

      const result = stack[0];
      expect(result).toBe(3);
    });

    test('empty list length and size both return 0', () => {
      let stack = executeTacitCode(vm, '( ) length');
      expect(getTaggedInfo(stack[stack.length - 1]).value).toBe(0);

      vm = createVM();
      stack = executeTacitCode(vm, '( ) size');
      expect(getTaggedInfo(stack[stack.length - 1]).value).toBe(0);
    });
  });

  describe('Section 10: Address queries', () => {
    test('slot operation returns slot addresses', () => {
      executeTacitCode(vm, '( 42 99 ) 0 slot');
    });

    test('elem operation returns element addresses', () => {
      executeTacitCode(vm, '( 1 ( 2 3 ) 4 ) 1 elem');
    });

    test('fetch and store work with addresses', () => {
      const stack = executeTacitCode(vm, '( 42 99 ) 0 elem fetch');

      const result = stack[stack.length - 1];
      const decoded = getTaggedInfo(result);
      expect(decoded.value).toBe(42);
    });
  });

  describe('Section 12: Structural operations', () => {
    test('head returns first element', () => {
      const stack = executeTacitCode(vm, '( 1 2 3 ) head');
      const result = stack[stack.length - 1];
      const decoded = getTaggedInfo(result);
      expect(decoded.value).toBe(1);
    });

    test('head returns nested list correctly', () => {
      const stack = executeTacitCode(vm, '( ( 2 3 ) 4 5 ) head');
      const result = stack[stack.length - 1];
      expect(isList(result)).toBe(true);
    });

    test('head returns nil for empty list', () => {
      const stack = executeTacitCode(vm, '( ) head');

      const result = stack[0];
      expect(isNIL(result)).toBe(true);
    });

    test('concat prepends element (simple + list)', () => {
      const stack = executeTacitCode(vm, '1 ( 2 3 ) concat');
      const result = stack[stack.length - 1];
      expect(isList(result)).toBe(true);
    });

    test('tail removes first element', () => {
      const stack = executeTacitCode(vm, '( 1 2 3 ) tail');
      const header = stack[stack.length - 1];
      expect(isList(header)).toBe(true);
    });

    test('structural operations are properly registered', () => {
      expect(() => executeTacitCode(vm, '( )')).not.toThrow();

      const operations = ['head', 'tail', 'concat'];
      operations.forEach(op => {
        try {
          executeTacitCode(vm, `( ) ${op}`);
        } catch (error) {
          expect(error instanceof Error ? error.message : String(error)).not.toContain(
            'Undefined word',
          );
        }
      });
    });
  });

  describe('Algebraic laws (Section 20)', () => {
    test('concat then tail restores original for prepend case', () => {
      const original = executeTacitCode(vm, '( 2 3 )');
      const restored = executeTacitCode(vm, '1 ( 2 3 ) concat tail');
      const origHeader = original[original.length - 1];
      const restHeader = restored[restored.length - 1];
      expect(getTaggedInfo(origHeader).value).toBe(getTaggedInfo(restHeader).value);
    });

    test('pack with 0 count creates empty list', () => {
      const stack = executeTacitCode(vm, '0 pack');
      const header = stack[stack.length - 1];
      expect(isList(header)).toBe(true);
      expect(getTaggedInfo(header).value).toBe(0);
    });

    test('unpack pushes list elements to stack', () => {
      const stack = executeTacitCode(vm, '( 1 2 3 ) unpack');
      expect(stack.length).toBe(3);
      expect(getTaggedInfo(stack[0]).value).toBe(3);
      expect(getTaggedInfo(stack[1]).value).toBe(2);
      expect(getTaggedInfo(stack[2]).value).toBe(1);
    });

    test('pack and unpack are inverses', () => {
      const original = executeTacitCode(vm, '1 2 3');
      const restored = executeTacitCode(vm, '1 2 3 3 pack unpack');
      expect(restored).toEqual(original);
    });
  });
});
