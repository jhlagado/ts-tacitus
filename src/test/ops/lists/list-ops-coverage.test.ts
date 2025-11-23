import { getTaggedInfo, isNIL } from '../../../core/tagged';
/**
 * Tests for list-ops.ts - targeting uncovered branches
 * This focuses on error conditions, edge cases, and debug output not covered in main list tests
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM } from '../../../core/vm';
import { openListOp, closeListOp, sizeOp } from '../../../ops/lists';
import { Tagged, Tag } from '../../../core/tagged';
import { getStackData, push, pop, peek } from '../../../core/vm';
import { encodeX1516 } from '../../../core/code-ref';

describe('List Operations - Branch Coverage', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
    vm.debug = false;
  });

  describe('openListOp functionality', () => {
    test('should initialize list construction correctly', () => {
      const initialRSP = vm.rsp; // absolute cells
      const initialListDepth = vm.compile.listDepth;

      openListOp(vm);

      expect(vm.compile.listDepth).toBe(initialListDepth + 1);
      expect(vm.rsp).toBe(initialRSP + 1); // one header cell pushed
      expect(getStackData(vm)).toHaveLength(1);
    });
  });

  describe('closeListOp functionality and edge cases', () => {
    test('should complete list construction correctly', () => {
      const initialListDepth = vm.compile.listDepth;

      openListOp(vm);
      push(vm, 42);
      closeListOp(vm);

      expect(vm.compile.listDepth).toBe(initialListDepth);
      expect(getStackData(vm)).toHaveLength(2);

      const header = peek(vm);
      const { tag, value } = getTaggedInfo(header);
      expect(tag).toBe(Tag.LIST);
      expect(value).toBe(1);
    });

    test('should handle empty lists (no reversal needed)', () => {
      openListOp(vm);
      closeListOp(vm);

      const header = peek(vm);
      const { tag, value } = getTaggedInfo(header);
      expect(tag).toBe(Tag.LIST);
      expect(value).toBe(0);
    });

    test('should handle lists with listDepth undefined (backward compatibility)', () => {
      const originalListDepth = vm.compile.listDepth;
      delete (vm as unknown as Record<string, unknown>).listDepth;

      openListOp(vm);
      push(vm, 42);
      push(vm, 24);
      closeListOp(vm);

      expect(getStackData(vm).length).toBeGreaterThan(0);

      vm.compile.listDepth = originalListDepth;
    });
  });

  describe('sizeOp edge cases', () => {
    test('should return NIL for non-list values', () => {
      push(vm, 42);

      sizeOp(vm);

      const result = pop(vm);
      expect(isNIL(result)).toBe(true);
    });

    test('should return 0 for empty lists', () => {
      const emptyList = Tagged(0, Tag.LIST);
      push(vm, emptyList);

      sizeOp(vm);

      const result = pop(vm);
      expect(result).toBe(0);
    });

    test('should count nested lists correctly', () => {
      openListOp(vm);
      push(vm, 1);
      openListOp(vm);
      push(vm, 2);
      push(vm, 3);
      closeListOp(vm);
      push(vm, 4);
      closeListOp(vm);

      sizeOp(vm);

      const lengthTagged = pop(vm);
      const { value: length } = getTaggedInfo(lengthTagged);
      expect(length).toBe(3);
    });
  });

  describe('Stack underflow protection', () => {
    test('sizeOp should handle empty stack', () => {
      expect(() => sizeOp(vm)).toThrow('Stack underflow');
    });

    test('closeListOp should handle return stack underflow', () => {
      expect(() => closeListOp(vm)).toThrow('Return stack (RSP) underflow');
    });
  });

  describe('List validation and type checking', () => {
    test('should handle large list headers', () => {
      const largeList = Tagged(100, Tag.LIST);
      push(vm, largeList);
      // With unified data and larger global segment, this should not throw.
      // We only assert that it executes and returns a numeric result or NIL.
      expect(() => sizeOp(vm)).not.toThrow();
    });

    test('should handle mixed data types in operations', () => {
      push(vm, Tagged(encodeX1516(104), Tag.CODE));
      sizeOp(vm);
      const result = pop(vm);
      expect(isNIL(result)).toBe(true);
    });
  });

  describe('Complex list structures', () => {
    test('should handle deeply nested list operations', () => {
      openListOp(vm);
      openListOp(vm);
      openListOp(vm);
      push(vm, 1);
      closeListOp(vm);
      closeListOp(vm);
      closeListOp(vm);

      sizeOp(vm);

      const lengthTagged = pop(vm);
      const { value: length } = getTaggedInfo(lengthTagged);
      expect(length).toBe(1);
    });

    test('should handle large lists efficiently', () => {
      openListOp(vm);

      for (let i = 0; i < 50; i++) {
        push(vm, i);
      }

      closeListOp(vm);

      sizeOp(vm);

      const lengthTagged = pop(vm);
      const { value: length } = getTaggedInfo(lengthTagged);
      expect(length).toBe(50);
    });
  });

  describe('Memory and stack management', () => {
    test('should maintain stack integrity during complex operations', () => {
      const initialSP = vm.sp;

      openListOp(vm);
      push(vm, 1);
      push(vm, 2);
      closeListOp(vm);

      sizeOp(vm);

      expect(vm.sp).toBeGreaterThan(initialSP);
      expect(getStackData(vm)).toBeDefined();
    });
  });
});
