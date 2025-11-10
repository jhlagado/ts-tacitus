/**
 * @file src/test/lang/globals/declaration.test.ts
 * Tests for global variable declaration (value global name)
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../../core';
import { executeTacitCode } from '../../utils/vm-test-utils';

describe('Global Variable Declaration', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('simple declarations', () => {
    test('should declare simple global variable', () => {
      const result = executeTacitCode(vm, '42 global myVar');
      expect(result).toEqual([]);

      // Verify global can be accessed
      const result2 = executeTacitCode(vm, 'myVar');
      expect(result2).toEqual([42]);
    });

    test('should declare multiple global variables', () => {
      executeTacitCode(vm, '10 global x');
      executeTacitCode(vm, '20 global y');

      const result = executeTacitCode(vm, 'x y add');
      expect(result).toEqual([30]);
    });

    test('should allow redeclaration (replaces previous)', () => {
      executeTacitCode(vm, '42 global myVar');
      executeTacitCode(vm, '100 global myVar'); // redeclare

      const result = executeTacitCode(vm, 'myVar');
      expect(result).toEqual([100]);
    });
  });

  describe.skip('compound declarations', () => {
    test('should declare global with list', () => {
      executeTacitCode(vm, '[1 2 3] global myList');

      const result = executeTacitCode(vm, 'myList');
      expect(result.length).toBe(4); // 3 elements + header
      expect(result[result.length - 1]).toBe(3); // header (length)
    });
  });

  describe('top-level restriction', () => {
    test('should allow global declaration at top level', () => {
      expect(() => {
        executeTacitCode(vm, '42 global topLevel');
      }).not.toThrow();
    });

    test('should reject global declaration inside function', () => {
      expect(() => {
        executeTacitCode(vm, ': foo 42 global insideFunc ;');
      }).toThrow(/Global declarations only allowed at top level/);
    });
  });

  describe('error handling', () => {
    test('should throw error for missing variable name', () => {
      expect(() => {
        executeTacitCode(vm, '42 global');
      }).toThrow(/Expected variable name after global/);
    });

    test('should throw error for invalid variable name', () => {
      expect(() => {
        executeTacitCode(vm, '42 global :');
      }).toThrow(/Expected variable name after global/);
    });
  });
});
