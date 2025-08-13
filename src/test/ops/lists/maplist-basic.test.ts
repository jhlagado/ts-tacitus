/**
 * Basic maplist tests - start simple and build up
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { executeTacitCode, resetVM } from '../../utils/vm-test-utils';

describe('Basic Maplist Tests', () => {
  beforeEach(() => {
    resetVM();
  });

  test('find operation should return something that is not NIL for existing key', () => {
    const result = executeTacitCode('( 1 100 ) 1 find');
    
    // Should have maplist + result on stack
    expect(result.length).toBeGreaterThan(1);
    
    // Last item should not be 0 (NIL) since key exists
    const findResult = result[result.length - 1];
    expect(findResult).not.toBe(0);
  });

  test('keys operation should not crash', () => {
    // Just verify it executes without error
    const result = executeTacitCode('( 1 100 ) keys');
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  test('values operation should not crash', () => {
    // Just verify it executes without error
    const result = executeTacitCode('( 1 100 ) values');
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});