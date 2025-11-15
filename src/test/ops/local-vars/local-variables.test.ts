/**
 * Local Variables Integration Tests
 * Tests the complete local variable system: Reserve → InitVar → VarRef → Fetch
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM, emitUint16 } from '../../../core/vm';
import { reserveOp, initVarOp } from '../../../ops/builtins';
import { fetchOp } from '../../../ops/lists';
import { getVarRef, writeRef } from '../../../core/refs';
import { RSTACK_BASE } from '../../../core/constants';
import { push, getStackData, pop } from '../../../core/vm';

describe('Local Variables System', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
    vm.debug = false;
  });

  describe('Basic Operations', () => {
    test('should handle complete workflow: reserve → init → fetch', () => {
      vm.bp = RSTACK_BASE + 16; // within current return-stack size

      // Reserve 1 slot
      emitUint16(vm, 1);
      reserveOp(vm);

      // Initialize slot 0 with value 42
      push(vm, 42);
      emitUint16(vm, 0);
      initVarOp(vm);

      // Fetch value using variable reference
      push(vm, getVarRef(vm, 0));
      fetchOp(vm);

      expect(getStackData(vm)).toEqual([42]);
    });

    test('should handle different data types', () => {
      vm.bp = RSTACK_BASE + 24;
      emitUint16(vm, 3);
      reserveOp(vm);

      // Test integer, float, negative
      const testValues = [42, 3.14159, -99.5];
      testValues.forEach((value, slot) => {
        push(vm, value);
        emitUint16(vm, slot);
        initVarOp(vm);
      });

      // Verify all values
      testValues.forEach((expectedValue, slot) => {
        push(vm, getVarRef(vm, slot));
        fetchOp(vm);
        if (Number.isInteger(expectedValue)) {
          expect(pop(vm)).toBe(expectedValue);
        } else {
          expect(pop(vm)).toBeCloseTo(expectedValue);
        }
      });
    });
  });

  describe('Multiple Variables', () => {
    test('should handle multiple variables without interference', () => {
      vm.bp = RSTACK_BASE + 28;
      emitUint16(vm, 5);
      reserveOp(vm);

      // Initialize with different values
      const values = [10, 20, 30, 40, 50];
      values.forEach((value, slot) => {
        push(vm, value);
        emitUint16(vm, slot);
        initVarOp(vm);
      });

      // Fetch in different order
      const fetchOrder = [3, 0, 4, 1, 2];
      const results: number[] = [];
      fetchOrder.forEach(slot => {
        push(vm, getVarRef(vm, slot));
        fetchOp(vm);
        results.push(pop(vm));
      });

      const expected = fetchOrder.map(slot => values[slot]);
      expect(results).toEqual(expected);
    });

    test('should handle slot overwrites', () => {
      vm.bp = RSTACK_BASE + 32;
      emitUint16(vm, 2);
      reserveOp(vm);

      // Initialize slot 0
      push(vm, 100);
      emitUint16(vm, 0);
      initVarOp(vm);

      // Overwrite slot 0
      push(vm, 200);
      emitUint16(vm, 0);
      initVarOp(vm);

      // Should get new value
      push(vm, getVarRef(vm, 0));
      fetchOp(vm);
      expect(pop(vm)).toBe(200);
    });
  });

  describe('Frame Isolation', () => {
    test('should isolate variables between different function frames', () => {
      // First frame
      vm.bp = RSTACK_BASE + 16;
      emitUint16(vm, 2);
      reserveOp(vm);
      push(vm, 111);
      emitUint16(vm, 0);
      initVarOp(vm);
      push(vm, 222);
      emitUint16(vm, 1);
      initVarOp(vm);

      // Verify first frame
      push(vm, getVarRef(vm, 0));
      fetchOp(vm);
      expect(pop(vm)).toBe(111);

      // Second frame (different BP)
      vm.bp = RSTACK_BASE + 40;
      emitUint16(vm, 2);
      reserveOp(vm);
      push(vm, 333);
      emitUint16(vm, 0);
      initVarOp(vm);
      push(vm, 444);
      emitUint16(vm, 1);
      initVarOp(vm);

      // Verify second frame
      push(vm, getVarRef(vm, 0));
      fetchOp(vm);
      expect(pop(vm)).toBe(333);

      // Switch back to first frame - should still have original values
      vm.bp = RSTACK_BASE + 16;
      push(vm, getVarRef(vm, 0));
      fetchOp(vm);
      expect(pop(vm)).toBe(111);
    });
  });

  describe('Edge Cases', () => {
    test('should handle large slot numbers', () => {
      vm.bp = RSTACK_BASE + 4;
      const maxSlot = 10;

      emitUint16(vm, maxSlot + 1);
      reserveOp(vm);

      push(vm, 999);
      emitUint16(vm, maxSlot);
      initVarOp(vm);

      push(vm, getVarRef(vm, maxSlot));
      fetchOp(vm);
      expect(pop(vm)).toBe(999);
    });

    test('should handle many variables efficiently', () => {
      vm.bp = RSTACK_BASE + 6;
      const numVars = 16;

      emitUint16(vm, numVars);
      reserveOp(vm);

      // Initialize all variables
      for (let i = 0; i < numVars; i++) {
        push(vm, i * 10);
        emitUint16(vm, i);
        initVarOp(vm);
      }

      // Verify every 10th variable
      for (let i = 0; i < numVars; i += 4) {
        push(vm, getVarRef(vm, i));
        fetchOp(vm);
        expect(pop(vm)).toBe(i * 10);
      }
    });
  });

  describe('Integration with Operations', () => {
    test('should work with arithmetic operations', () => {
      vm.bp = RSTACK_BASE + 20;
      emitUint16(vm, 3);
      reserveOp(vm);

      // Store operands
      push(vm, 15);
      emitUint16(vm, 0);
      initVarOp(vm); // a = 15
      push(vm, 25);
      emitUint16(vm, 1);
      initVarOp(vm); // b = 25

      // Calculate: a + b
      push(vm, getVarRef(vm, 0));
      fetchOp(vm);
      push(vm, getVarRef(vm, 1));
      fetchOp(vm);
      const sum = pop(vm) + pop(vm);

      // Store result
      push(vm, sum);
      emitUint16(vm, 2);
      initVarOp(vm);

      // Verify result
      push(vm, getVarRef(vm, 2));
      fetchOp(vm);
      expect(pop(vm)).toBe(40);
    });

    test('should work with do combinator', () => {
      vm.bp = RSTACK_BASE + 24;
      emitUint16(vm, 1);
      reserveOp(vm);

      push(vm, 42);
      emitUint16(vm, 0);
      initVarOp(vm);

      // Simple operation using local variable
      push(vm, getVarRef(vm, 0));
      fetchOp(vm);
      push(vm, 10);
      const result = pop(vm) + pop(vm);
      push(vm, result);

      expect(pop(vm)).toBe(52);
    });
  });

  describe('Variable Mutation', () => {
    test('should support variable mutation via writeRef', () => {
      vm.bp = RSTACK_BASE + 28;
      emitUint16(vm, 1);
      reserveOp(vm);

      // Initialize with 42
      push(vm, 42);
      emitUint16(vm, 0);
      initVarOp(vm);

      // Verify initial value
      push(vm, getVarRef(vm, 0));
      fetchOp(vm);
      expect(pop(vm)).toBe(42);

      // Mutate using writeRef
      const varRef = getVarRef(vm, 0);
      writeRef(vm, varRef, 99);

      // Verify mutation
      push(vm, getVarRef(vm, 0));
      fetchOp(vm);
      expect(pop(vm)).toBe(99);
    });

    test('should handle multiple variable mutations', () => {
      vm.bp = RSTACK_BASE + 32;
      emitUint16(vm, 3);
      reserveOp(vm);

      // Initialize variables
      const initialValues = [10, 20, 30];
      initialValues.forEach((value, slot) => {
        push(vm, value);
        emitUint16(vm, slot);
        initVarOp(vm);
      });

      // Mutate all variables
      const newValues = [100, 200, 300];
      newValues.forEach((value, slot) => {
        const varRef = getVarRef(vm, slot);
        writeRef(vm, varRef, value);
      });

      // Verify all mutations
      newValues.forEach((expectedValue, slot) => {
        push(vm, getVarRef(vm, slot));
        fetchOp(vm);
        expect(pop(vm)).toBe(expectedValue);
      });
    });

    test('should maintain isolation during mixed read/write operations', () => {
      vm.bp = RSTACK_BASE + 36;
      emitUint16(vm, 2);
      reserveOp(vm);

      // Initialize variables
      push(vm, 111);
      emitUint16(vm, 0);
      initVarOp(vm);
      push(vm, 222);
      emitUint16(vm, 1);
      initVarOp(vm);

      // Read first, mutate second
      push(vm, getVarRef(vm, 0));
      fetchOp(vm);
      pop(vm);

      writeRef(vm, getVarRef(vm, 1), 999);

      // Verify first unchanged, second mutated
      push(vm, getVarRef(vm, 0));
      fetchOp(vm);
      expect(pop(vm)).toBe(111); // unchanged

      push(vm, getVarRef(vm, 1));
      fetchOp(vm);
      expect(pop(vm)).toBe(999); // mutated
    });
  });
});
