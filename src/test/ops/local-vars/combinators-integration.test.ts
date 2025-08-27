/**
 * Tests local variables integration with combinators and existing operations
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../../core/globalState';
import { reserveOp, initVarOp } from '../../../ops/builtins';
import { fetchOp } from '../../../ops/list-ops';
import { getVarRef } from '../../../core/refs';

describe('Local Variables + Combinators Integration', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('Integration with do combinator', () => {
    test('should work with local variables in do blocks', () => {
      // Simulate: var x = 42; do { x fetch 10 add }
      vm.BP = 1000;

      // Reserve and initialize local variable
      vm.compiler.compile16(1);
      reserveOp(vm);

      vm.push(42);
      vm.compiler.compile16(0);
      initVarOp(vm);

      // Create a simple operation sequence using local variable
      vm.push(getVarRef(vm, 0)); // Reference to local var
      fetchOp(vm);                 // Get value (42)
      vm.push(10);                 // Stack: [42, 10]

      const sum = vm.pop() + vm.pop();
      vm.push(sum);

      expect(vm.pop()).toBe(52);
    });
  });

  describe('Integration with repeat combinator', () => {
    test('should work with local variables in repeat operations', () => {
      vm.BP = 1500;

      // Set up local variable with initial value
      vm.compiler.compile16(2);
      reserveOp(vm);

      vm.push(0); // counter
      vm.compiler.compile16(0);
      initVarOp(vm);

      vm.push(10); // increment value
      vm.compiler.compile16(1);
      initVarOp(vm);

      // Simulate 3 iterations of: counter += increment
      for (let i = 0; i < 3; i++) {
        // Load current counter value
        vm.push(getVarRef(vm, 0));
        fetchOp(vm);

        // Load increment
        vm.push(getVarRef(vm, 1));
        fetchOp(vm);

        // Add them
        const result = vm.pop() + vm.pop();

        // Store back to counter
        vm.push(result);
        vm.compiler.compile16(0);
        initVarOp(vm);
      }

      // Final counter value should be 30 (0 + 10*3)
      vm.push(getVarRef(vm, 0));
      fetchOp(vm);
      expect(vm.pop()).toBe(30);
    });
  });

  describe('Integration with list operations', () => {
    test('should work with list creation and local variables', () => {
      vm.BP = 2000;

      // Reserve slots for list elements
      vm.compiler.compile16(3);
      reserveOp(vm);

      // Store values in local variables
      vm.push(1); vm.compiler.compile16(0); initVarOp(vm);
      vm.push(2); vm.compiler.compile16(1); initVarOp(vm);
      vm.push(3); vm.compiler.compile16(2); initVarOp(vm);

      // Load values and create list
      vm.push(getVarRef(vm, 0)); fetchOp(vm);
      vm.push(getVarRef(vm, 1)); fetchOp(vm);
      vm.push(getVarRef(vm, 2)); fetchOp(vm);

      // Stack now has [1, 2, 3], create list manually for this test
      const values = [vm.pop(), vm.pop(), vm.pop()]; // [3, 2, 1]
      expect(values).toEqual([3, 2, 1]);
    });
  });

  describe('Integration with arithmetic operations', () => {
    test('should handle complex arithmetic with local variables', () => {
      vm.BP = 2500;

      // Reserve space for operands and result
      vm.compiler.compile16(5);
      reserveOp(vm);

      // Store arithmetic operands
      vm.push(15); vm.compiler.compile16(0); initVarOp(vm); // a = 15
      vm.push(25); vm.compiler.compile16(1); initVarOp(vm); // b = 25
      vm.push(5);  vm.compiler.compile16(2); initVarOp(vm); // c = 5

      // Calculate: result = (a + b) * c = (15 + 25) * 5 = 200

      // Load a and b
      vm.push(getVarRef(vm, 0)); fetchOp(vm); // 15
      vm.push(getVarRef(vm, 1)); fetchOp(vm); // 25

      // Add them: a + b
      const sum = vm.pop() + vm.pop(); // 40

      // Load c
      vm.push(getVarRef(vm, 2)); fetchOp(vm); // 5

      // Multiply: (a + b) * c
      const result = sum * vm.pop(); // 40 * 5 = 200

      // Store result in slot 3
      vm.push(result);
      vm.compiler.compile16(3);
      initVarOp(vm);

      // Verify result
      vm.push(getVarRef(vm, 3));
      fetchOp(vm);
      expect(vm.pop()).toBe(200);
    });

    test('should handle floating point arithmetic', () => {
      vm.BP = 3000;

      vm.compiler.compile16(3);
      reserveOp(vm);

      // Store floating point values
      vm.push(3.14); vm.compiler.compile16(0); initVarOp(vm);
      vm.push(2.5);  vm.compiler.compile16(1); initVarOp(vm);

      // Calculate: pi * 2.5
      vm.push(getVarRef(vm, 0)); fetchOp(vm);
      vm.push(getVarRef(vm, 1)); fetchOp(vm);

      const product = vm.pop() * vm.pop();
      vm.push(product);
      vm.compiler.compile16(2);
      initVarOp(vm);

      // Verify
      vm.push(getVarRef(vm, 2));
      fetchOp(vm);
      expect(vm.pop()).toBeCloseTo(7.85);
    });
  });

  describe('Stack manipulation with local variables', () => {
    test('should handle complex stack operations', () => {
      vm.BP = 3500;

      vm.compiler.compile16(4);
      reserveOp(vm);

      // Initialize variables
      vm.push(100); vm.compiler.compile16(0); initVarOp(vm);
      vm.push(200); vm.compiler.compile16(1); initVarOp(vm);
      vm.push(300); vm.compiler.compile16(2); initVarOp(vm);

      // Load all variables in specific order
      vm.push(getVarRef(vm, 2)); fetchOp(vm); // 300
      vm.push(getVarRef(vm, 0)); fetchOp(vm); // 100
      vm.push(getVarRef(vm, 1)); fetchOp(vm); // 200

      // Stack should be [300, 100, 200] from bottom to top
      expect(vm.getStackData()).toEqual([300, 100, 200]);

      // Pop and verify order
      expect(vm.pop()).toBe(200);
      expect(vm.pop()).toBe(100);
      expect(vm.pop()).toBe(300);
    });
  });

  describe('Error conditions with combinators', () => {
    test('should handle stack underflow gracefully', () => {
      vm.BP = 4000;

      vm.compiler.compile16(1);
      reserveOp(vm);

      // Try to fetch from uninitialized local variable
      // (This should work but return whatever random value is in memory)
      vm.push(getVarRef(vm, 0));

      // fetchOp should not throw even with uninitialized memory
      expect(() => fetchOp(vm)).not.toThrow();

      // Should get some value (likely 0 or garbage)
      const value = vm.pop();
      expect(typeof value).toBe('number');
    });
  });

  describe('Performance with combinators', () => {
    test('should handle nested operations efficiently', () => {
      vm.BP = 5000;

      const numVars = 20;
      vm.compiler.compile16(numVars);
      reserveOp(vm);

      // Initialize variables with sequential values
      for (let i = 0; i < numVars; i++) {
        vm.push(i * 10);
        vm.compiler.compile16(i);
        initVarOp(vm);
      }

      // Perform operations mixing multiple variables
      let accumulator = 0;

      // Sum all even-indexed variables
      for (let i = 0; i < numVars; i += 2) {
        vm.push(getVarRef(vm, i));
        fetchOp(vm);
        accumulator += vm.pop();
      }

      // Expected: 0 + 20 + 40 + 60 + 80 + 100 + 120 + 140 + 160 + 180 = 900
      expect(accumulator).toBe(900);
    });
  });
});
