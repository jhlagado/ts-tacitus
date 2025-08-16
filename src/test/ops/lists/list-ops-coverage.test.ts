/**
 * Tests for list-ops.ts - targeting uncovered branches
 * This focuses on error conditions, edge cases, and debug output not covered in main list tests
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
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
      const { tag, value } = require('../../../core/tagged').fromTaggedValue(header);
      expect(tag).toBe(Tag.LIST);
      expect(value).toBe(1);
    });

    test('should handle empty lists (no reversal needed)', () => {
      openListOp(vm);
      // Don't add any elements
      closeListOp(vm);

      // Should have created an empty list
      const header = vm.peek();
      const { tag, value } = require('../../../core/tagged').fromTaggedValue(header);
      expect(tag).toBe(Tag.LIST);
      expect(value).toBe(0); // Empty list
    });

    test('should handle lists with listDepth undefined (backward compatibility)', () => {
      // Temporarily remove listDepth to test backward compatibility
      const originalListDepth = vm.listDepth;
      delete (vm as unknown as Record<string, unknown>).listDepth;

      openListOp(vm);
      vm.push(42);
      vm.push(24);
      closeListOp(vm);

      // Should still work
      expect(vm.getStackData().length).toBeGreaterThan(0);

      // Restore listDepth
      vm.listDepth = originalListDepth;
    });
  });

  describe('lengthOp edge cases', () => {
    test('should return NIL for non-list values', () => {
      vm.push(42); // Not a list

      lengthOp(vm);

      const result = vm.pop();
      const { tag, value } = require('../../../core/tagged').fromTaggedValue(result);
      expect(tag).toBe(Tag.SENTINEL);
      expect(value).toBe(0); // NIL is INTEGER 0
    });

    test('should return 0 for empty lists', () => {
      // Create an empty list
      const emptyList = toTaggedValue(0, Tag.LIST);
      vm.push(emptyList);

      lengthOp(vm);

      const result = vm.pop();
      const { tag, value } = require('../../../core/tagged').fromTaggedValue(result);
      expect(tag).toBe(Tag.SENTINEL);
      expect(value).toBe(0); // Length is 0
    });

    test('should count nested lists correctly', () => {
      // Create a list with nested structure: ( 1 ( 2 3 ) 4 )
      // This is complex to set up manually, so we'll use a simpler approach
      openListOp(vm);
      vm.push(1);
      openListOp(vm);
      vm.push(2);
      vm.push(3);
      closeListOp(vm); // Creates inner list
      vm.push(4);
      closeListOp(vm); // Creates outer list

      lengthOp(vm);

      const lengthTagged = vm.pop();
      const { value: length } = require('../../../core/tagged').fromTaggedValue(lengthTagged);
      expect(length).toBe(3); // Three elements: 1, nested-list, 4
    });
  });

  // listPrependOp was deprecated and removed - functionality available via 'cons' operation

  describe('Stack underflow protection', () => {
    test('lengthOp should handle empty stack', () => {
      expect(() => lengthOp(vm)).toThrow('Stack underflow');
    });

    // listPrependOp was deprecated and removed - functionality available via 'cons' operation

    test('listSlotOp should handle non-list at TOS', () => {
      vm.push(42); // Not a list
      expect(() => listSlotOp(vm)).toThrow(); // Should throw validation error
    });

    test('closeListOp should handle return stack underflow', () => {
      // Don't call openListOp first, so return stack is empty
      expect(() => closeListOp(vm)).toThrow('Return stack underflow');
    });
  });

  describe('List validation and type checking', () => {
    test('should handle large list headers', () => {
      // Create a list tag with large (but reasonable) slot count
      const largeList = toTaggedValue(100, Tag.LIST); // Large but safe slot count
      vm.push(largeList);

      // Some operations should handle this gracefully (though may fail due to memory)
      expect(() => lengthOp(vm)).toThrow(); // Will likely throw due to memory access
    });

    test('should handle mixed data types in operations', () => {
      vm.push(toTaggedValue(100, Tag.CODE)); // CODE value

      lengthOp(vm);

      // Should return NIL for non-list
      const result = vm.pop();
      const { tag, value } = require('../../../core/tagged').fromTaggedValue(result);
      expect(tag).toBe(Tag.SENTINEL);
      expect(value).toBe(0); // NIL
    });

    // STRING value handling test - deprecated operations removed
  });

  describe('Complex list structures', () => {
    test('should handle deeply nested list operations', () => {
      // Create: ( ( ( 1 ) ) )
      openListOp(vm);
      openListOp(vm);
      openListOp(vm);
      vm.push(1);
      closeListOp(vm);
      closeListOp(vm);
      closeListOp(vm);

      lengthOp(vm);

      const lengthTagged = vm.pop();
      const { value: length } = require('../../../core/tagged').fromTaggedValue(lengthTagged);
      expect(length).toBe(1); // One element (the nested structure)
    });

    test('should handle large lists efficiently', () => {
      openListOp(vm);

      // Add many elements
      for (let i = 0; i < 50; i++) {
        vm.push(i);
      }

      closeListOp(vm);

      lengthOp(vm);

      const lengthTagged = vm.pop();
      const { value: length } = require('../../../core/tagged').fromTaggedValue(lengthTagged);
      expect(length).toBe(50);
    });
  });

  describe('Memory and stack management', () => {
    test('should maintain stack integrity during complex operations', () => {
      const initialSP = vm.SP;

      // Perform several list operations
      openListOp(vm);
      vm.push(1);
      vm.push(2);
      closeListOp(vm);

      // List prepend functionality moved to 'cons' operation

      lengthOp(vm);

      // Stack should be in valid state
      expect(vm.SP).toBeGreaterThan(initialSP);
      expect(vm.getStackData()).toBeDefined();
    });

    // listSkipOp was deprecated and removed - functionality available via 'drop' operation
  });
});
