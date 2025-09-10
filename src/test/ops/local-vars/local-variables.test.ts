/**
 * Local Variables Integration Tests
 * Tests the complete local variable system: Reserve → InitVar → VarRef → Fetch
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../../core/global-state';
import { reserveOp, initVarOp } from '../../../ops/builtins';
import { fetchOp } from '../../../ops/lists';
import { getVarRef, writeReference } from '../../../core/refs';

describe('Local Variables System', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('Basic Operations', () => {
    test('should handle complete workflow: reserve → init → fetch', () => {
  vm.BPBytes = 1000;

      // Reserve 1 slot
      vm.compiler.compile16(1);
      reserveOp(vm);

      // Initialize slot 0 with value 42
      vm.push(42);
      vm.compiler.compile16(0);
      initVarOp(vm);

      // Fetch value using variable reference
      vm.push(getVarRef(vm, 0));
      fetchOp(vm);

      expect(vm.getStackData()).toEqual([42]);
    });

    test('should handle different data types', () => {
  vm.BPBytes = 1500;
      vm.compiler.compile16(3);
      reserveOp(vm);

      // Test integer, float, negative
      const testValues = [42, 3.14159, -99.5];
      testValues.forEach((value, slot) => {
        vm.push(value);
        vm.compiler.compile16(slot);
        initVarOp(vm);
      });

      // Verify all values
      testValues.forEach((expectedValue, slot) => {
        vm.push(getVarRef(vm, slot));
        fetchOp(vm);
        if (Number.isInteger(expectedValue)) {
          expect(vm.pop()).toBe(expectedValue);
        } else {
          expect(vm.pop()).toBeCloseTo(expectedValue);
        }
      });
    });
  });

  describe('Multiple Variables', () => {
    test('should handle multiple variables without interference', () => {
  vm.BPBytes = 2000;
      vm.compiler.compile16(5);
      reserveOp(vm);

      // Initialize with different values
      const values = [10, 20, 30, 40, 50];
      values.forEach((value, slot) => {
        vm.push(value);
        vm.compiler.compile16(slot);
        initVarOp(vm);
      });

      // Fetch in different order
      const fetchOrder = [3, 0, 4, 1, 2];
      const results: number[] = [];
      fetchOrder.forEach(slot => {
        vm.push(getVarRef(vm, slot));
        fetchOp(vm);
        results.push(vm.pop());
      });

      const expected = fetchOrder.map(slot => values[slot]);
      expect(results).toEqual(expected);
    });

    test('should handle slot overwrites', () => {
  vm.BPBytes = 2500;
      vm.compiler.compile16(2);
      reserveOp(vm);

      // Initialize slot 0
      vm.push(100);
      vm.compiler.compile16(0);
      initVarOp(vm);

      // Overwrite slot 0
      vm.push(200);
      vm.compiler.compile16(0);
      initVarOp(vm);

      // Should get new value
      vm.push(getVarRef(vm, 0));
      fetchOp(vm);
      expect(vm.pop()).toBe(200);
    });
  });

  describe('Frame Isolation', () => {
    test('should isolate variables between different function frames', () => {
      // First frame
  vm.BPBytes = 1000;
      vm.compiler.compile16(2);
      reserveOp(vm);
      vm.push(111);
      vm.compiler.compile16(0);
      initVarOp(vm);
      vm.push(222);
      vm.compiler.compile16(1);
      initVarOp(vm);

      // Verify first frame
      vm.push(getVarRef(vm, 0));
      fetchOp(vm);
      expect(vm.pop()).toBe(111);

      // Second frame (different BP)
  vm.BPBytes = 5000;
      vm.compiler.compile16(2);
      reserveOp(vm);
      vm.push(333);
      vm.compiler.compile16(0);
      initVarOp(vm);
      vm.push(444);
      vm.compiler.compile16(1);
      initVarOp(vm);

      // Verify second frame
      vm.push(getVarRef(vm, 0));
      fetchOp(vm);
      expect(vm.pop()).toBe(333);

      // Switch back to first frame - should still have original values
  vm.BPBytes = 1000;
      vm.push(getVarRef(vm, 0));
      fetchOp(vm);
      expect(vm.pop()).toBe(111);
    });
  });

  describe('Edge Cases', () => {
    test('should handle large slot numbers', () => {
  vm.BPBytes = 8000;
      const maxSlot = 100;

      vm.compiler.compile16(maxSlot + 1);
      reserveOp(vm);

      vm.push(999);
      vm.compiler.compile16(maxSlot);
      initVarOp(vm);

      vm.push(getVarRef(vm, maxSlot));
      fetchOp(vm);
      expect(vm.pop()).toBe(999);
    });

    test('should handle many variables efficiently', () => {
  vm.BPBytes = 10000;
      const numVars = 50;

      vm.compiler.compile16(numVars);
      reserveOp(vm);

      // Initialize all variables
      for (let i = 0; i < numVars; i++) {
        vm.push(i * 10);
        vm.compiler.compile16(i);
        initVarOp(vm);
      }

      // Verify every 10th variable
      for (let i = 0; i < numVars; i += 10) {
        vm.push(getVarRef(vm, i));
        fetchOp(vm);
        expect(vm.pop()).toBe(i * 10);
      }
    });
  });

  describe('Integration with Operations', () => {
    test('should work with arithmetic operations', () => {
  vm.BPBytes = 6000;
      vm.compiler.compile16(3);
      reserveOp(vm);

      // Store operands
      vm.push(15);
      vm.compiler.compile16(0);
      initVarOp(vm); // a = 15
      vm.push(25);
      vm.compiler.compile16(1);
      initVarOp(vm); // b = 25

      // Calculate: a + b
      vm.push(getVarRef(vm, 0));
      fetchOp(vm);
      vm.push(getVarRef(vm, 1));
      fetchOp(vm);
      const sum = vm.pop() + vm.pop();

      // Store result
      vm.push(sum);
      vm.compiler.compile16(2);
      initVarOp(vm);

      // Verify result
      vm.push(getVarRef(vm, 2));
      fetchOp(vm);
      expect(vm.pop()).toBe(40);
    });

    test('should work with do combinator', () => {
  vm.BPBytes = 7000;
      vm.compiler.compile16(1);
      reserveOp(vm);

      vm.push(42);
      vm.compiler.compile16(0);
      initVarOp(vm);

      // Simple operation using local variable
      vm.push(getVarRef(vm, 0));
      fetchOp(vm);
      vm.push(10);
      const result = vm.pop() + vm.pop();
      vm.push(result);

      expect(vm.pop()).toBe(52);
    });
  });

  describe('Variable Mutation', () => {
    test('should support variable mutation via writeReference', () => {
  vm.BPBytes = 8000;
      vm.compiler.compile16(1);
      reserveOp(vm);

      // Initialize with 42
      vm.push(42);
      vm.compiler.compile16(0);
      initVarOp(vm);

      // Verify initial value
      vm.push(getVarRef(vm, 0));
      fetchOp(vm);
      expect(vm.pop()).toBe(42);

      // Mutate using writeReference
      const varRef = getVarRef(vm, 0);
      writeReference(vm, varRef, 99);

      // Verify mutation
      vm.push(getVarRef(vm, 0));
      fetchOp(vm);
      expect(vm.pop()).toBe(99);
    });

    test('should handle multiple variable mutations', () => {
  vm.BPBytes = 8500;
      vm.compiler.compile16(3);
      reserveOp(vm);

      // Initialize variables
      const initialValues = [10, 20, 30];
      initialValues.forEach((value, slot) => {
        vm.push(value);
        vm.compiler.compile16(slot);
        initVarOp(vm);
      });

      // Mutate all variables
      const newValues = [100, 200, 300];
      newValues.forEach((value, slot) => {
        const varRef = getVarRef(vm, slot);
        writeReference(vm, varRef, value);
      });

      // Verify all mutations
      newValues.forEach((expectedValue, slot) => {
        vm.push(getVarRef(vm, slot));
        fetchOp(vm);
        expect(vm.pop()).toBe(expectedValue);
      });
    });

    test('should maintain isolation during mixed read/write operations', () => {
  vm.BPBytes = 9000;
      vm.compiler.compile16(2);
      reserveOp(vm);

      // Initialize variables
      vm.push(111);
      vm.compiler.compile16(0);
      initVarOp(vm);
      vm.push(222);
      vm.compiler.compile16(1);
      initVarOp(vm);

      // Read first, mutate second
      vm.push(getVarRef(vm, 0));
      fetchOp(vm);
      vm.pop();

      writeReference(vm, getVarRef(vm, 1), 999);

      // Verify first unchanged, second mutated
      vm.push(getVarRef(vm, 0));
      fetchOp(vm);
      expect(vm.pop()).toBe(111); // unchanged

      vm.push(getVarRef(vm, 1));
      fetchOp(vm);
      expect(vm.pop()).toBe(999); // mutated
    });
  });
});
