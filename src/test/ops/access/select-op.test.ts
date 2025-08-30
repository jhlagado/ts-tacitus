/**
 * selectOp tests - Path-based address access
 * Tests the select operation that returns addresses/refs instead of values
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { resetVM, executeTacitCode } from '../../utils/vm-test-utils';
import { NIL } from '../../../core/tagged';

describe('selectOp - Path-based address access', () => {
  beforeEach(() => {
    resetVM();
  });

  test('should return NIL for empty path', () => {
    const result = executeTacitCode('( 1 2 3 ) ( ) select');
    expect(result[result.length - 1]).toBe(NIL);
  });

  test('should return NIL for non-list target', () => {
    const result = executeTacitCode('42 ( 1 ) select');
    expect(result[result.length - 1]).toBe(NIL);
  });

  test('should handle simple numeric path', () => {
    // Simple case: number as path (should be treated as single-element path)
    expect(() => {
      executeTacitCode('( 10 20 30 ) 1 select drop drop');
    }).not.toThrow();
  });

  test('should handle simple path as list', () => {
    const result = executeTacitCode('( 1 2 3 ) ( 1 ) select');
    // Should return NIL for odd-length list (not a valid maplist)
    expect(result[result.length - 1]).toBe(NIL);
  });
});