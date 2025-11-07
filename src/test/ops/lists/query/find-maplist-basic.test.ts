/**
 * Basic maplist tests - start simple and build up
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { executeTacitCode, resetVM, getFormattedStack } from '../../../utils/vm-test-utils';

describe('Basic Maplist Tests', () => {
  beforeEach(() => {
    resetVM();
  });

  test('find operation should return something that is not NIL for existing key', () => {
    const result = executeTacitCode('( 1 100 ) 1 find');

    expect(result.length).toBeGreaterThan(1);

    const findResult = result[result.length - 1];
    expect(findResult).not.toBe(0);
  });

  test('keys operation should not crash', () => {
    const result = executeTacitCode('( 1 100 ) keys');
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  test('values operation should not crash', () => {
    const result = executeTacitCode('( 1 100 ) values');
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  test('find operation with string keys', () => {
    // Test that find + fetch works correctly
    const result = executeTacitCode("( 'key 42 ) 'key find fetch");
    expect(result[result.length - 1]).toBe(42);
  });

  test('find operation with reference targets', () => {
    const result = executeTacitCode("( 'key 42 ) ref 'key find fetch");
    expect(result[result.length - 1]).toBe(42);
  });

  test('basic string equality test', () => {
    executeTacitCode('"string" "string"');

    const result = executeTacitCode('"string" "string" eq');
    expect(result[result.length - 1]).toBe(1); // Should be 1 for true
  });
});
