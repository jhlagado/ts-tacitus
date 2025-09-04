/**
 * Tests for list manipulation operations - Extracted from stack operation test files
 * Focuses on how list-aware stack operations handle lists differently from simple values
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { executeTacitCode, resetVM } from "../../../utils/vm-test-utils";
import { vm } from '../../../../core/globalState';
import { pickOp } from '../../../../ops/stack';
import { elemOp } from '../../../../ops/lists';
import { isRef } from '../../../../core/refs';
import { getTag, isNIL } from '../../../../core/tagged';

describe('List Operations', () => {
  beforeEach(() => {
    resetVM();
  });


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
      expect(stack.length).toBe(7);
    });

    test('should rotate a list with two simple values', () => {
      const stack = executeTacitCode('( 1 2 ) 3 4 rot');
      expect(stack.length).toBe(5);
    });

    test('should pick a list from the stack', () => {
      vm.push(10);
      vm.push(20);
      vm.push(1);
      pickOp(vm);
      const stack = vm.getStackData();
      expect(stack[stack.length - 1]).toBe(10);
    });
  });


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

  describe('elem operation tests', () => {
    test('should access element from simple list', () => {
      const result = executeTacitCode('( 10 20 30 ) 1 elem');
      expect(result.length).toBeGreaterThan(3); // Should have list + reference
      const ref = result[result.length - 1];
      expect(isRef(ref)).toBe(true);
    });

    test('should access element 0 from simple list', () => {
      const result = executeTacitCode('( 30 40 ) 0 elem');
      expect(result.length).toBeGreaterThan(2); // Should have list + reference
      const ref = result[result.length - 1];
      expect(isRef(ref)).toBe(true);
    });

    test('should handle nested list access - reproduce select-ops issue', () => {
      // This reproduces our failing case from select-ops:
      // Target: ( ( 10 20 ) ( 30 40 ) )
      // Step 1: get element 1 → reference to ( 30 40 )
      // Step 2: get element 0 of that reference → reference to 30

      console.log('\n=== Testing nested list elem access ===');

      // Step 1: Get reference to nested sublist
      const result1 = executeTacitCode('( ( 10 20 ) ( 30 40 ) ) 1 elem');
      console.log('Step 1 result (should be ref to (30 40)):', result1);
      const ref1 = result1[result1.length - 1];
      console.log('Step 1 ref - tag:', getTag(ref1), 'isRef:', isRef(ref1));
      expect(isRef(ref1)).toBe(true);

      // Step 2: Use that reference to access element 0
      // Current stack: ( ( 10 20 ) ( 30 40 ) ) ref-to-(30 40)
      vm.push(0); // Add index 0
      console.log('Before second elemOp:', vm.getStackData());

      elemOp(vm); // Should give us ref to element 0 of (30 40), which is 30

      console.log('After second elemOp:', vm.getStackData());
      const finalRef = vm.peek();
      console.log('Final ref - tag:', getTag(finalRef), 'isNIL:', isNIL(finalRef));

      // This is the assertion that should pass but currently fails in select-ops
      expect(isNIL(finalRef)).toBe(false);
    });

    test('should test direct double elem access as user suggested', () => {
      console.log('\n=== Testing ( ( 10 20 ) ( 30 40 ) ) 0 elem 0 elem ===');

      const result = executeTacitCode('( ( 10 20 ) ( 30 40 ) ) 0 elem 0 elem fetch');
      console.log('Final result with fetch:', result);

      const finalValue = result[result.length - 1];
      console.log('Final fetched value:', finalValue);
      console.log('Expected: should be 10 (element 0 of element 0)');
    });

    test('should test the exact select-ops case: 1 elem then 0 elem', () => {
      console.log('\n=== Testing ( ( 10 20 ) ( 30 40 ) ) 1 elem 0 elem ===');

      const result = executeTacitCode('( ( 10 20 ) ( 30 40 ) ) 1 elem 0 elem fetch');
      console.log('Final result with fetch:', result);

      const finalValue = result[result.length - 1];
      console.log('Final fetched value:', finalValue);
      console.log('Expected: should be 30 (element 0 of element 1)');
    });

    test('should show step by step what happens', () => {
      console.log('\n=== Step by step analysis ===');

      // Target: ( ( 10 20 ) ( 30 40 ) )
      // Element 0 is ( 10 20 )
      // Element 1 is ( 30 40 )

      const step1 = executeTacitCode('( ( 10 20 ) ( 30 40 ) ) 1 elem fetch');
      console.log('Step 1 - get element 1 and fetch:', step1);
      console.log('Should be ( 30 40 ) - first element is:', step1[step1.length - 2], 'second element is:', step1[step1.length - 1]);

      const step2 = executeTacitCode('( ( 10 20 ) ( 30 40 ) ) 1 elem 0 elem fetch');
      console.log('Step 2 - get element 1, then element 0, then fetch:', step2);
      console.log('Should be 30, but got:', step2[step2.length - 1]);

      const step0 = executeTacitCode('( ( 10 20 ) ( 30 40 ) ) 0 elem 0 elem fetch');
      console.log('For comparison - get element 0, then element 0, then fetch:', step0);
      console.log('Should be 10, but got:', step0[step0.length - 1]);

      console.log('\n=== The problem is clear: off-by-one in reference-based elem access ===');
    });

    // Removed skipped debug test to keep suite lean

    test('sizeOp verification - next op to fix', () => {
      console.log('\n=== Testing sizeOp (already uses correct approach) ===');

      // Test 1: Direct list access
      const direct = executeTacitCode('( 10 20 30 ) size');
      console.log('Direct ( 10 20 30 ) size:', direct[direct.length - 1]);
      console.log('Expected: 3 elements, Got:', direct[direct.length - 1]);

      // Test 2: Reference-based access (this should work correctly)
      const ref = executeTacitCode('( ( 10 20 ) ( 30 40 ) ) 1 elem size');
      console.log('Reference ( ( 10 20 ) ( 30 40 ) ) 1 elem size:', ref[ref.length - 1]);
      console.log('Expected: 2 elements in (30 40), Got:', ref[ref.length - 1]);

      // Test 3: Empty list
      const empty = executeTacitCode('( ) size');
      console.log('Empty list size:', empty[empty.length - 1]);
      console.log('Expected: 0, Got:', empty[empty.length - 1]);

      console.log('=== sizeOp uses getListHeaderAndBase correctly - should work! ===');
    });
  });
});
