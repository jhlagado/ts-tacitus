/**
 * selectOp tests - Path-based address access
 * Tests the select operation that returns addresses/refs instead of values
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { resetVM, executeTacitCode, testTacitCode } from '../../utils/vm-test-utils';
import { NIL } from '../../../core/tagged';

describe.skip('selectOp - Path-based address access', () => {
  beforeEach(() => {
    resetVM();
  });

  test('should return NIL for empty path', () => {
    const result = executeTacitCode(`
      ( 1 2 3 ) ( ) select
    `);
    expect(result[result.length - 1]).toBe(NIL);
  });

  test('should return NIL for non-list target', () => {
    const result = executeTacitCode(`
      42 ( 1 ) select
    `);
    expect(result[result.length - 1]).toBe(NIL);
  });

  test('should handle single-level numeric index access', () => {
    testTacitCode('( 10 20 30 ) ( 1 ) select fetch', [20]);
  });

  test('should handle single-level key access', () => {
    testTacitCode('( `a 100 `b 200 ) ( `b ) select fetch', [200]);
  });

  test('should handle nested key access', () => {
    testTacitCode('( `a 1 `b ( `c 3 `d 4 ) ) ( `b `d ) select fetch', [4]);
  });

  test('should handle nested numeric index access', () => {
    testTacitCode('( 10 ( 20 30 ) 40 ) ( 1 1 ) select fetch', [30]);
  });

  test('should handle mixed key and index access', () => {
    testTacitCode('( `a 1 `b ( 100 200 ) ) ( `b 1 ) select fetch', [200]);
  });

  test('should handle deeper nesting', () => {
    testTacitCode('( `data ( ( 1 2 ) ( 3 ( `x 99 ) ) ) ) ( `data 1 1 `x ) select fetch', [99]);
  });

  test('should return NIL for invalid path', () => {
    const result = executeTacitCode('( 1 2 3 ) ( 5 ) select');
    expect(result[result.length - 1]).toBe(NIL);
  });

  test('should return NIL for invalid nested path', () => {
    const result = executeTacitCode('( `a ( `b 2 ) ) ( `a `c ) select');
    expect(result[result.length - 1]).toBe(NIL);
  });

  test('should return a valid reference that can be used with store', () => {
    testTacitCode(
      '( 10 20 30 ) ( 1 ) select 99 swap store fetch',
      [10, 99, 30]
    );
  });

  test('should return a reference for nested structures that can be used with store', () => {
    const code = `
      ( \`a 1 \`b ( 100 200 ) )         \\ target
      ( \`b 0 ) select                  \\ get ref to 100
      999 swap store                  \\ store 999 into that ref
      ( \`b 0 ) select fetch            \\ fetch the new value
    `;
    // The final stack should be: [original_list, new_value]
    // We pop the list and check the value.
    const stack = executeTacitCode(code);
    const finalValue = stack.pop();
    expect(finalValue).toBe(999);
  });
});
