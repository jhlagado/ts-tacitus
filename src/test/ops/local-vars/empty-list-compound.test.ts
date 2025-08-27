/**
 * Tests for compound local variables - starting with empty lists
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../../core/globalState';
import { executeTacitCode } from '../../utils/vm-test-utils';
import { getTag, Tag } from '../../../core/tagged';

describe('Empty List Compound Variables', () => {
  beforeEach(() => {
    initializeInterpreter();
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
    const tag = getTag(result[0]);
    expect(tag).toBe(Tag.LOCAL_REF); // Should return reference, not copy
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

  test('should materialize actual list with unref', () => {
    const result = executeTacitCode(`
      : test-unref
        () var emptyList
        emptyList unref
      ;
      test-unref
    `);
    
    expect(result).toHaveLength(1);
    const tag = getTag(result[0]);
    expect(tag).toBe(Tag.LIST); // Should return actual LIST, not reference
  });

  test('should compare unref result with direct empty list', () => {
    const directList = executeTacitCode('()');
    const unrefList = executeTacitCode(`
      : unref-list
        () var emptyList
        emptyList unref
      ;
      unref-list
    `);
    
    expect(unrefList).toEqual(directList);
  });
});