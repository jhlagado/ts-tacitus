import { fromTaggedValue } from '../../../core/tagged';
/**
 * Tests for list-ops.ts - targeting uncovered branches
 * This focuses on error conditions, edge cases, and debug output not covered in main list tests
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../../core/globalState';
import { openListOp, closeListOp, listSlotOp, lengthOp } from '../../../ops/list-ops';
import { toTaggedValue, Tag } from '../../../core/tagged';

describe('List Operations - Branch Coverage', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('openListOp functionality', () => {
    test('should initialize list construction correctly', () => {
      const initialRP = vm.RP;
      const initialListDepth = vm.listDepth;

      openListOp(vm);

      expect(vm.listDepth).toBe(initialListDepth + 1);
      expect(vm.RP).toBe(initialRP + 4);
      expect(vm.getStackData()).toHaveLength(1);
    });
  });

  describe('closeListOp functionality and edge cases', () => {
    test('should complete list construction correctly', () => {
      const initialListDepth = vm.listDepth;

      openListOp(vm);
      vm.push(42);
      closeListOp(vm);

      expect(vm.listDepth).toBe(initialListDepth);
      expect(vm.getStackData()).toHaveLength(2);

      const header = vm.peek();
  const { tag, value } = fromTaggedValue(header);
  expect(tag).toBe(Tag.LIST);
  expect(value).toBe(1);
    });

    test('should handle empty lists (no reversal needed)', () => {
      openListOp(vm);
      closeListOp(vm);

      const header = vm.peek();
  const { tag, value } = fromTaggedValue(header);
  expect(tag).toBe(Tag.LIST);
  expect(value).toBe(0); 
    });

    test('should handle lists with listDepth undefined (backward compatibility)', () => {
      const originalListDepth = vm.listDepth;
      delete (vm as unknown as Record<string, unknown>).listDepth;

      openListOp(vm);
      vm.push(42);
      vm.push(24);
      closeListOp(vm);

      expect(vm.getStackData().length).toBeGreaterThan(0);

      vm.listDepth = originalListDepth;
    });
  });

  describe('lengthOp edge cases', () => {
    test('should return NIL for non-list values', () => {
      vm.push(42); 

      lengthOp(vm);

      const result = vm.pop();
  const { tag, value } = fromTaggedValue(result);
  expect(tag).toBe(Tag.SENTINEL);
  expect(value).toBe(0); 
    });

    test('should return 0 for empty lists', () => {
      const emptyList = toTaggedValue(0, Tag.LIST);
      vm.push(emptyList);

      lengthOp(vm);

      const result = vm.pop();
  const { tag, value } = fromTaggedValue(result);
  expect(tag).toBe(Tag.SENTINEL);
  expect(value).toBe(0); 
    });

    test('should count nested lists correctly', () => {
      openListOp(vm);
      vm.push(1);
      openListOp(vm);
      vm.push(2);
      vm.push(3);
      closeListOp(vm); 
      vm.push(4);
      closeListOp(vm); 

      lengthOp(vm);

      const lengthTagged = vm.pop();
  const { value: length } = fromTaggedValue(lengthTagged);
  expect(length).toBe(3); 
    });
  });


  describe('Stack underflow protection', () => {
    test('lengthOp should handle empty stack', () => {
      expect(() => lengthOp(vm)).toThrow('Stack underflow');
    });


    test('listSlotOp should handle non-list at TOS', () => {
      vm.push(42); 
      expect(() => listSlotOp(vm)).toThrow(); 
    });

    test('closeListOp should handle return stack underflow', () => {
      expect(() => closeListOp(vm)).toThrow('Return stack underflow');
    });
  });

  describe('List validation and type checking', () => {
    test('should handle large list headers', () => {
      const largeList = toTaggedValue(100, Tag.LIST); 
      vm.push(largeList);

      expect(() => lengthOp(vm)).toThrow(); 
    });

    test('should handle mixed data types in operations', () => {
      vm.push(toTaggedValue(100, Tag.CODE)); 

      lengthOp(vm);

      const result = vm.pop();
  const { tag, value } = fromTaggedValue(result);
  expect(tag).toBe(Tag.SENTINEL);
  expect(value).toBe(0); 
    });

  });

  describe('Complex list structures', () => {
    test('should handle deeply nested list operations', () => {
      openListOp(vm);
      openListOp(vm);
      openListOp(vm);
      vm.push(1);
      closeListOp(vm);
      closeListOp(vm);
      closeListOp(vm);

      lengthOp(vm);

      const lengthTagged = vm.pop();
  const { value: length } = fromTaggedValue(lengthTagged);
  expect(length).toBe(1); 
    });

    test('should handle large lists efficiently', () => {
      openListOp(vm);

      for (let i = 0; i < 50; i++) {
        vm.push(i);
      }

      closeListOp(vm);

      lengthOp(vm);

      const lengthTagged = vm.pop();
  const { value: length } = fromTaggedValue(lengthTagged);
  expect(length).toBe(50);
    });
  });

  describe('Memory and stack management', () => {
    test('should maintain stack integrity during complex operations', () => {
      const initialSP = vm.SP;

      openListOp(vm);
      vm.push(1);
      vm.push(2);
      closeListOp(vm);


      lengthOp(vm);

      expect(vm.SP).toBeGreaterThan(initialSP);
      expect(vm.getStackData()).toBeDefined();
    });

  });
});
