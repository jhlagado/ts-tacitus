/**
 * End-to-end integration tests for local variable system
 * Tests complete workflow: Reserve → InitVar → LocalRef → Fetch
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../../core/globalState';
import { reserveOp, initVarOp } from '../../../ops/builtins';
import { fetchOp } from '../../../ops/list-ops';
import { createLocalRef } from '../../../core/tagged';

describe('Local Variables End-to-End Integration', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('Complete workflow: Reserve → InitVar → LocalRef → Fetch', () => {
    test('should handle simple number values end-to-end', () => {
      // Simulate function call setup
      vm.BP = 2000;
      const initialRP = vm.RP;
      
      // Step 1: Reserve space for 3 local variables
      vm.compiler.compile16(3); // 3 slots
      reserveOp(vm);
      
      const expectedRP = initialRP + (3 * 4); // 3 slots * 4 bytes each
      expect(vm.RP).toBe(expectedRP);
      
      // Step 2: Initialize slot 1 with value 42
      vm.push(42);
      vm.compiler.compile16(1); // slot 1
      initVarOp(vm);
      
      // Step 3: Create reference to slot 1 and fetch value
      const localRef = createLocalRef(1);
      vm.push(localRef);
      fetchOp(vm);
      
      // Step 4: Verify we got the original value back
      expect(vm.getStackData()).toEqual([42]);
    });

    test('should handle floating point values', () => {
      vm.BP = 1500;
      
      // Reserve 2 slots
      vm.compiler.compile16(2);
      reserveOp(vm);
      
      // Store π in slot 0
      vm.push(3.14159);
      vm.compiler.compile16(0);
      initVarOp(vm);
      
      // Fetch via local reference
      vm.push(createLocalRef(0));
      fetchOp(vm);
      
      expect(vm.pop()).toBeCloseTo(3.14159);
    });

    test('should handle negative values', () => {
      vm.BP = 1000;
      
      vm.compiler.compile16(1);
      reserveOp(vm);
      
      vm.push(-99.5);
      vm.compiler.compile16(0);
      initVarOp(vm);
      
      vm.push(createLocalRef(0));
      fetchOp(vm);
      
      expect(vm.pop()).toBe(-99.5);
    });

    test('should handle zero values', () => {
      vm.BP = 500;
      
      vm.compiler.compile16(1);
      reserveOp(vm);
      
      vm.push(0);
      vm.compiler.compile16(0);
      initVarOp(vm);
      
      vm.push(createLocalRef(0));
      fetchOp(vm);
      
      expect(vm.pop()).toBe(0);
    });
  });

  describe('Multiple local variables in same function', () => {
    test('should handle multiple variables without interference', () => {
      vm.BP = 3000;
      
      // Reserve 5 slots
      vm.compiler.compile16(5);
      reserveOp(vm);
      
      // Initialize multiple slots with different values
      const testValues = [10, 20, 30, 40, 50];
      testValues.forEach((value, slot) => {
        vm.push(value);
        vm.compiler.compile16(slot);
        initVarOp(vm);
      });
      
      // Fetch values in different order and verify
      const fetchOrder = [3, 0, 4, 1, 2];
      const results: number[] = [];
      
      fetchOrder.forEach(slot => {
        vm.push(createLocalRef(slot));
        fetchOp(vm);
        results.push(vm.pop());
      });
      
      const expectedResults = fetchOrder.map(slot => testValues[slot]);
      expect(results).toEqual(expectedResults);
    });

    test('should handle sparse slot usage', () => {
      vm.BP = 2500;
      
      // Reserve 10 slots but only use slots 1, 5, and 9
      vm.compiler.compile16(10);
      reserveOp(vm);
      
      // Initialize only specific slots
      vm.push(100); vm.compiler.compile16(1); initVarOp(vm);
      vm.push(500); vm.compiler.compile16(5); initVarOp(vm);
      vm.push(900); vm.compiler.compile16(9); initVarOp(vm);
      
      // Fetch the values
      vm.push(createLocalRef(5));
      fetchOp(vm);
      expect(vm.pop()).toBe(500);
      
      vm.push(createLocalRef(1));
      fetchOp(vm);
      expect(vm.pop()).toBe(100);
      
      vm.push(createLocalRef(9));
      fetchOp(vm);
      expect(vm.pop()).toBe(900);
    });

    test('should handle slot overwrites correctly', () => {
      vm.BP = 4000;
      
      vm.compiler.compile16(2);
      reserveOp(vm);
      
      // Initialize slot 0 with first value
      vm.push(111);
      vm.compiler.compile16(0);
      initVarOp(vm);
      
      // Overwrite slot 0 with new value
      vm.push(222);
      vm.compiler.compile16(0);
      initVarOp(vm);
      
      // Should get the new value
      vm.push(createLocalRef(0));
      fetchOp(vm);
      expect(vm.pop()).toBe(222);
    });
  });

  describe('Different function frames (different BP values)', () => {
    test('should isolate variables between function frames', () => {
      // First function frame
      vm.BP = 1000;
      vm.compiler.compile16(2);
      reserveOp(vm);
      
      vm.push(111); vm.compiler.compile16(0); initVarOp(vm);
      vm.push(222); vm.compiler.compile16(1); initVarOp(vm);
      
      // Verify first frame values
      vm.push(createLocalRef(0)); fetchOp(vm);
      expect(vm.pop()).toBe(111);
      vm.push(createLocalRef(1)); fetchOp(vm);
      expect(vm.pop()).toBe(222);
      
      // Second function frame (different BP)
      vm.BP = 5000;
      vm.compiler.compile16(2);
      reserveOp(vm);
      
      vm.push(333); vm.compiler.compile16(0); initVarOp(vm);
      vm.push(444); vm.compiler.compile16(1); initVarOp(vm);
      
      // Verify second frame values
      vm.push(createLocalRef(0)); fetchOp(vm);
      expect(vm.pop()).toBe(333);
      vm.push(createLocalRef(1)); fetchOp(vm);
      expect(vm.pop()).toBe(444);
      
      // Switch back to first frame and verify isolation
      vm.BP = 1000;
      vm.push(createLocalRef(0)); fetchOp(vm);
      expect(vm.pop()).toBe(111); // Still the original value
    });
  });

  describe('Integration with existing operations', () => {
    test('should work with arithmetic operations', () => {
      vm.BP = 6000;
      
      vm.compiler.compile16(3);
      reserveOp(vm);
      
      // Store values for arithmetic
      vm.push(10); vm.compiler.compile16(0); initVarOp(vm); // slot 0 = 10
      vm.push(5);  vm.compiler.compile16(1); initVarOp(vm); // slot 1 = 5
      
      // Load both values and add them
      vm.push(createLocalRef(0)); fetchOp(vm); // Stack: [10]
      vm.push(createLocalRef(1)); fetchOp(vm); // Stack: [10, 5]
      
      // Add them
      const sum = vm.pop() + vm.pop();
      vm.push(sum);
      
      expect(vm.pop()).toBe(15);
    });

    test('should work with stack operations', () => {
      vm.BP = 7000;
      
      vm.compiler.compile16(2);
      reserveOp(vm);
      
      vm.push(42); vm.compiler.compile16(0); initVarOp(vm);
      vm.push(24); vm.compiler.compile16(1); initVarOp(vm);
      
      // Load values in specific order
      vm.push(createLocalRef(0)); fetchOp(vm); // Stack: [42]
      vm.push(createLocalRef(1)); fetchOp(vm); // Stack: [42, 24]
      
      // Verify stack contents
      expect(vm.getStackData()).toEqual([42, 24]);
      
      // Pop in reverse order
      expect(vm.pop()).toBe(24);
      expect(vm.pop()).toBe(42);
    });
  });

  describe('Error handling and edge cases', () => {
    test('should handle maximum slot numbers', () => {
      vm.BP = 8000;
      
      // Large slot number (still within 16-bit unsigned range)
      const maxSlot = 1000;
      vm.compiler.compile16(maxSlot + 1);
      reserveOp(vm);
      
      vm.push(999);
      vm.compiler.compile16(maxSlot);
      initVarOp(vm);
      
      vm.push(createLocalRef(maxSlot));
      fetchOp(vm);
      
      expect(vm.pop()).toBe(999);
    });

    test('should handle very large BP values', () => {
      vm.BP = 50000; // Large base pointer
      
      vm.compiler.compile16(2);
      reserveOp(vm);
      
      vm.push(12345);
      vm.compiler.compile16(1);
      initVarOp(vm);
      
      vm.push(createLocalRef(1));
      fetchOp(vm);
      
      expect(vm.pop()).toBe(12345);
    });
  });

  describe('Performance and stress testing', () => {
    test('should handle many local variables efficiently', () => {
      vm.BP = 10000;
      
      const numSlots = 100;
      vm.compiler.compile16(numSlots);
      reserveOp(vm);
      
      // Initialize all slots
      for (let i = 0; i < numSlots; i++) {
        vm.push(i * 10); // Values: 0, 10, 20, 30, ...
        vm.compiler.compile16(i);
        initVarOp(vm);
      }
      
      // Fetch values in reverse order
      for (let i = numSlots - 1; i >= 0; i--) {
        vm.push(createLocalRef(i));
        fetchOp(vm);
        expect(vm.pop()).toBe(i * 10);
      }
    });
  });
});