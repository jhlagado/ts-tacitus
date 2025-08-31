/**
 * selectOp tests - Path-based address access
 * Tests the select operation that returns addresses/refs instead of values
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { resetVM, executeTacitCode } from '../../utils/vm-test-utils';
import { NIL } from '../../../core/tagged';

describe.skip('selectOp - Path-based address access', () => {
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

  test('should handle two-element numeric path', () => {
    // Debug elem operations on the outer list
    const elem0 = executeTacitCode('( ( 1 2 3 ) ( 4 5 6 ) ) 0 elem fetch');
    console.log('elem 0 result:', elem0.slice(-3));

    const elem1 = executeTacitCode('( ( 1 2 3 ) ( 4 5 6 ) ) 1 elem fetch');
    console.log('elem 1 result:', elem1.slice(-3));

    // Full path test
    const result = executeTacitCode('( ( 1 2 3 ) ( 4 5 6 ) ) ( 1 0 ) select fetch');
    expect(result[result.length - 1]).toBe(4);
  });

  test('should handle mixed path with number then string', () => {
    // Structure: ( ("name" "John" "age" 25) ("name" "Jane" "age" 30) )
    // Path ( 0 "name" ) should get first maplist, then "name" key = "John"
    const result = executeTacitCode('( ( "name" "John" "age" 25 ) ( "name" "Jane" "age" 30 ) ) ( 0 "name" ) select fetch');
    expect(result[result.length - 1]).toBe("John");
  });
});
