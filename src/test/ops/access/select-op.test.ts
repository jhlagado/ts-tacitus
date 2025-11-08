/**
 * selectOp tests - Path-based address access
 * Tests the select operation that returns addresses/refs instead of values
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../../core';
import { executeTacitCode } from '../../utils/vm-test-utils';
import { STACK_BASE, CELL_SIZE } from '../../../core/constants';
import { getTag, NIL, Tag } from '../../../core/tagged';
import {
  createTargetRef,
  traverseMultiPath,
  processPathStep,
} from '../../../ops/access/select-ops';
import { fetchOp } from '../../../ops/lists/query-ops';
import { isRef, getRefRegion } from '../../../core/refs';
import { peek } from '../../../core/vm';
// legacy segment id 0 denotes stack region in decodeRef classification

describe('selectOp - Path-based address access', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('should return NIL for empty path', () => {
    const result = executeTacitCode(vm, '( 1 2 3 ) ( ) select');
    expect(result[result.length - 1]).toBe(NIL);
  });

  test('should return NIL for non-list target', () => {
    const result = executeTacitCode(vm, '42 ( 1 ) select');
    expect(result[result.length - 1]).toBe(NIL);
  });

  describe('createTargetRef function', () => {
    test('should create stack ref for list target', () => {
      // Set up stack: target path
      executeTacitCode(vm, '( 10 20 30 ) ( 1 )');

      const success = createTargetRef(vm);
      expect(success).toBe(true);

      // Should have: target path target-ref
      const targetRef = peek(vm);
      expect(isRef(targetRef)).toBe(true);
      expect(getRefRegion(targetRef)).toBe('stack');
    });

    test('should return false for simple target', () => {
      // Set up stack: target path
      executeTacitCode(vm, '42 ( 1 )');

      const success = createTargetRef(vm);
      expect(success).toBe(false);
    });
  });

  describe('processPathStep function', () => {
    test('should verify elemOp works with simple list', () => {
      // Simple test: ( 10 20 30 ) 1 elem should give reference to 20
      const result = executeTacitCode(vm, '( 10 20 30 ) 1 elem');
      expect(result.length).toBeGreaterThan(3); // Should have list + reference
      const ref = result[result.length - 1];
      expect(isRef(ref)).toBe(true);
    });

    test('should verify elemOp works with element 0', () => {
      // Test: ( 30 40 ) 0 elem should give reference to 30
      const result = executeTacitCode(vm, '( 30 40 ) 0 elem');
      expect(result.length).toBeGreaterThan(2); // Should have list + reference
      const ref = result[result.length - 1];
      expect(isRef(ref)).toBe(true);
    });

    test('should process numeric path element', () => {
      // Set up: target path current-ref
      executeTacitCode(vm, '( 10 20 30 ) ( 1 )');
      createTargetRef(vm);

      const success = processPathStep(vm, 1);

      expect(success).toBe(true);
      // Should have: target path result-ref
      expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(7); // 4 for target + 2 for path + 1 for result-ref
      const resultRef = peek(vm);
      expect(isRef(resultRef)).toBe(true);
    });

    test('should handle two-step path traversal manually', () => {
      // Set up nested target: ( ( 10 20 ) ( 30 40 ) )
      // Path: ( 1 0 ) - get element 1 (which is (30 40)), then element 0 (which is 30)
      executeTacitCode(vm, '( ( 10 20 ) ( 30 40 ) ) ( 1 0 )');

      createTargetRef(vm);

      // First step: process path element 1 (should get ref to (30 40))
      const success1 = processPathStep(vm, 1);
      expect(success1).toBe(true);

      if (success1) {
        // Second step: process path element 0 (should get ref to 30)
        const success2 = processPathStep(vm, 0);
        expect(success2).toBe(true);

        expect(success2).toBe(true);
        const finalRef = peek(vm);
        expect(isRef(finalRef)).toBe(true);

        // Fetch the actual value and assert it is 30
        fetchOp(vm);
        const fetched = peek(vm);
        expect(fetched).toBe(30);
      }
    });

    test('should return false for NIL result', () => {
      // Skip this test until we fix the stack manipulation
      // The issue is that elemOp is getting wrong stack layout
      executeTacitCode(vm, '( 10 20 30 ) ( 99 )');
      createTargetRef(vm);

      const success = processPathStep(vm, 99);

      expect(success).toBe(false);
      expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(5);
      const result = peek(vm);
      expect(result).toBe(NIL);
    });
  });

  describe('traverseMultiPath function', () => {
    test('should traverse single element path', () => {
      // Set up: target path target-ref
      executeTacitCode(vm, '( 10 20 30 ) ( 1 )');
      createTargetRef(vm);

      traverseMultiPath(vm);

      // Should have: target final-ref
      expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(5); // 4 for target + 1 for final-ref
      const finalRef = peek(vm);
      expect(isRef(finalRef)).toBe(true);
    });
  });

  // Integration tests - skipped for now
  test('should handle simple numeric path (list path)', () => {
    expect(() => {
      executeTacitCode(vm, "( 'a 10 'b 20 'c 30 ) 'a select drop drop");
    }).not.toThrow();
  });

  test('should handle simple path as list with fetch', () => {
    const result = executeTacitCode(vm, '( 1 2 3 ) ( 1 ) select fetch');
    expect(result[result.length - 1]).toBe(2);
  });

  test('should handle simple numeric path (scalar path)', () => {
    expect(() => {
      executeTacitCode(vm, '( 10 20 30 ) 1 select drop drop');
    }).not.toThrow();
  });

  test('should handle two-element numeric path', () => {
    const elem0 = executeTacitCode(vm, '( ( 1 2 3 ) ( 4 5 6 ) ) 0 elem fetch');
    expect(elem0.length).toBeGreaterThan(0);

    const elem1 = executeTacitCode(vm, '( ( 1 2 3 ) ( 4 5 6 ) ) 1 elem fetch');
    expect(elem1.length).toBeGreaterThan(0);

    const result = executeTacitCode(vm, '( ( 1 2 3 ) ( 4 5 6 ) ) ( 1 0 ) select fetch');
    expect(result[result.length - 1]).toBe(4);
  });

  test('should handle two-step numeric path on ( (10 20) (30 40) ) -> 30', () => {
    const result = executeTacitCode(vm, '( ( 10 20 ) ( 30 40 ) ) ( 1 0 ) select fetch');
    expect(result[result.length - 1]).toBe(30);
  });

  test('should handle mixed path with number then string', () => {
    const result = executeTacitCode(
      vm,
      '( ( ' + "'name \"John\" 'age 25 ) ( 'name \"Jane\" 'age 30 ) ) ( 0 'name ) select fetch",
    );
    // Fetch returns a STRING tagged value; verify tag (content check via digest is outside this test)
    const last = result[result.length - 1];
    expect(getTag(last)).toBe(Tag.STRING);
  });

  test('should handle selection on stack REF target', () => {
    const result = executeTacitCode(vm, '( ( 10 20 ) ( 30 40 ) ) ref ( 1 0 ) select fetch');
    expect(result[result.length - 1]).toBe(30);
  });

  test('should handle selection on return-stack REF target', () => {
    const result = executeTacitCode(
      vm,
      ': f ( ( 10 20 ) ( 30 40 ) ) var xs &xs ( 1 0 ) select fetch ; f',
    );
    expect(result[result.length - 1]).toBe(30);
  });

  test('should return default value for missing key when default present', () => {
    const result = executeTacitCode(vm, "( 'a 1 'default 42 ) ( 'b ) select fetch");
    expect(result[result.length - 1]).toBe(42);
  });

  test('should traverse mixed numeric/string path to nested field', () => {
    const code =
      "( ( 'user ( 'name \"Ada\" 'age 37 ) ) ( 'user ( 'name \"Bob\" 'age 44 ) ) ) ( 1 'user 'age ) select fetch";
    const result = executeTacitCode(vm, code);
    expect(result[result.length - 1]).toBe(44);
  });

  test('scalar numeric path returns correct value with fetch', () => {
    const result = executeTacitCode(vm, '( 1 2 3 ) 1 select fetch');
    expect(result[result.length - 1]).toBe(2);
  });

  test('out-of-bounds early returns NIL', () => {
    const result = executeTacitCode(vm, '( ( 10 20 ) ( 30 40 ) ) ( 99 0 ) select');
    expect(result[result.length - 1]).toBe(NIL);
  });
});
