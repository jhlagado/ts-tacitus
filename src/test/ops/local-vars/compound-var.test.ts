/**
 * Tests for compound local variables - starting with empty lists
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm } from '../../../lang/runtime';
import { executeTacitCode, resetVM } from '../../utils/vm-test-utils';
import { isList, getListLength } from '../../../core/list';

describe('Compound Variables - Empty Lists', () => {
  beforeEach(() => {
    resetVM();
    vm.debug = false;
  });

  test('should store empty list in local variable and return reference', () => {
    const result = executeTacitCode(`
      : test-empty-var
        () var emptyList
        emptyList
      ;
      test-empty-var
    `);

    expect(result).toHaveLength(1);
    // Test behavioral difference: references and direct lists behave differently
    // A reference should work with resolve to materialize the list
    const materializedResult = executeTacitCode(`
      : test-empty-materialized
        () var emptyList
        emptyList load
      ;
      test-empty-materialized
    `);
    expect(materializedResult).toHaveLength(1);
    // Both should work with length operation but reference doesn't need resolve
    const refLength = executeTacitCode(`
      : test-ref-length
        () var emptyList
        emptyList length
      ;
      test-ref-length
    `);
    expect(refLength).toEqual([0]);
  });

  test('should work with length operation polymorphically', () => {
    const result = executeTacitCode(`
      : test-ref-length
        () var emptyList
        emptyList length
      ;
      test-ref-length
    `);

    expect(result).toEqual([0]); // length of empty list should be 0
  });

  test('should match direct empty list length', () => {
    const directLength = executeTacitCode('() length');
    const varLength = executeTacitCode(`
      : var-length
        () var emptyList
        emptyList length
      ;
      var-length
    `);

    expect(varLength).toEqual(directLength);
    expect(varLength).toEqual([0]);
  });

  test('should materialize actual list with load', () => {
    // Test behavioral equivalence rather than tagged value inspection
    const directEmpty = executeTacitCode('()');
    const resolveEmpty = executeTacitCode(`
      : test-resolve
        () var emptyList
        emptyList load
      ;
      test-resolve
    `);

    expect(resolveEmpty).toHaveLength(1);
    expect(directEmpty).toHaveLength(1);
    // Test that both behave the same with length operation
    const directLength = executeTacitCode('() length');
    const resolveLength = executeTacitCode(`
      : test-resolve-length
        () var emptyList
        emptyList load length
      ;
      test-resolve-length
    `);
    expect(resolveLength).toEqual(directLength);
    expect(resolveLength).toEqual([0]);
  });
});

describe('Compound Variables - Single Element Lists', () => {
  beforeEach(() => {
    resetVM();
    vm.debug = false;
  });

  test('should store single-element list in local variable and return value', () => {
    const result = executeTacitCode(`
      : test-single-var
        (1) var singleList
        singleList
      ;
      test-single-var
    `);

    expect(result).toHaveLength(2); // Now returns value: [1, LIST:1]
    expect(result[0]).toBe(1); // First element should be 1

    // Test explicit reference access with &x sigil
    const refResult = executeTacitCode(`
      : test-single-ref
        (1) var singleList
        &singleList
      ;
      test-single-ref
    `);
    expect(refResult).toHaveLength(1); // Should be DATA_REF resolving to return stack
  });

  test('should work with length operation on single-element list', () => {
    const result = executeTacitCode(`
      : test-single-length
        (1) var singleList
        singleList length
      ;
      test-single-length
    `);

    expect(result).toEqual([1]); // length of single-element list should be 1
  });

  test('should match direct single-element list length', () => {
    const directLength = executeTacitCode('(1) length');
    const varLength = executeTacitCode(`
      : var-single-length
        (1) var singleList
        singleList length
      ;
      var-single-length
    `);

    expect(varLength).toEqual(directLength);
    expect(varLength).toEqual([1]);
  });

  test('should materialize triple-element list with load', () => {
    const result = executeTacitCode(`
      : test-triple-resolve
        (1 2 3) var tripleList
        tripleList load
      ;
      test-triple-resolve
    `);

    expect(result).toHaveLength(4); // Should be [3 2 1, LIST:1]
    expect(isList(result[3])).toBe(true); // Header should be LIST
    expect(getListLength(result[3])).toBe(3);
    expect(result[0]).toBe(3); // First element should be 3
    expect(result[1]).toBe(2); // Second element should be 2
    expect(result[2]).toBe(1); // Third element should be 1
  });

  test('should work with head operation on single-element list', () => {
    const result = executeTacitCode(`
      : test-single-head
        (1) var singleList
        singleList head
      ;
      test-single-head
    `);

    expect(result).toEqual([1]); // head of (1) should be 1
  });
});
