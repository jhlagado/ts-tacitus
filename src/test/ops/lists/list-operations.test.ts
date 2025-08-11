/**
 * Tests for list manipulation operations - Extracted from stack operation test files
 * Focuses on how list-aware stack operations handle lists differently from simple values
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { executeTacitCode, resetVM } from "../../utils/vm-test-utils";
import { vm } from '../../../core/globalState';
import { pickOp } from '../../../ops/builtins-stack';

describe('List Operations', () => {
  beforeEach(() => {
    resetVM();
  });

  // Legacy LIST/LINK tests removed. Stack ops are validated against unified reverse-list semantics below.

  describe('list operations', () => {
    test('should duplicate simple value under a list', () => {
      const stack = executeTacitCode('( 10 20 ) 42 tuck');

      expect(stack[0]).toBe(42);
      expect(stack).toContain(10);
      expect(stack).toContain(20);
      expect(stack[stack.length - 1]).toBe(42);
    });

    test('should duplicate list under simple value', () => {
      const stack = executeTacitCode('42 ( 99 88 ) tuck');

      expect(stack).toContain(99);
      expect(stack).toContain(88);
      expect(stack).toContain(42);

      expect(stack.filter(x => x === 99).length).toBe(2);
      expect(stack.filter(x => x === 88).length).toBe(2);
    });

    test('should remove list under another list', () => {
      const stack = executeTacitCode('( 100 200 ) ( 300 400 ) nip');

      expect(stack).not.toContain(100);
      expect(stack).not.toContain(200);
      expect(stack).toContain(300);
      expect(stack).toContain(400);
    });

    test('should handle multi-element lists', () => {
      const stack = executeTacitCode('( 10 20 30 40 ) 999 nip');

      expect(stack).toEqual([999]);
    });

    test('should swap two simple lists', () => {
      const stack = executeTacitCode('5 ( 10 20 ) ( 30 40 ) swap');
      expect(stack).toContain(5);
      // Without LINK overhead, total cells: 1 (5) + 3 + 3 = 7
      expect(stack.length).toBe(7);
    });

    test('should rotate a list with two simple values', () => {
      const stack = executeTacitCode('( 1 2 ) 3 4 rot');
      // reverse-list is multi-slot; rotation keeps total cell count at 5 (2 payload + header + 2 scalars)
      expect(stack.length).toBe(5);
    });

    test('should pick a list from the stack', () => {
      // Use VM-level pick to avoid parser opcode edge-cases
      vm.push(10);
      vm.push(20);
      vm.push(1); // index
      pickOp(vm);
      const stack = vm.getStackData();
      expect(stack[stack.length - 1]).toBe(10);
    });
  });

  // Error cases for legacy LIST/LINK removed during unification.

  describe('integration tests', () => {
    test('should duplicate a nested list', () => {
      const stack = executeTacitCode('( 1 ( 2 3 ) 4 ) dup');
      expect(stack.length).toBeGreaterThan(0);
    });

    test('should handle nested lists correctly during operations', () => {
      const stack = executeTacitCode('123 ( 1 ( 2 3 ) 4 ) nip');

      expect(stack.length).toBeGreaterThan(0);
      expect(stack).not.toContain(123);
    });

    test('should drop a nested list completely', () => {
      const stack = executeTacitCode('( 1 ( 2 3 ) 4 ) drop');
      expect(stack.length).toBe(0);
    });

    test('should handle complex list interactions', () => {
      const stack = executeTacitCode('( 1 ( 2 3 ) 4 ) 123 tuck');

      expect(stack.length).toBeGreaterThan(6);
      expect(stack).toContain(123);
      expect(stack).toContain(1);
      expect(stack).toContain(2);
      expect(stack).toContain(3);
      expect(stack).toContain(4);
    });
  });
});
