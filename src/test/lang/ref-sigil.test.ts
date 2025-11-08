/**
 * Reference Sigil (&x) Parsing Tests
 * Tests the &x sigil parsing and compilation behavior
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../core';
import { executeTacitCode } from '../utils/vm-test-utils';

describe('Reference Sigil (&x) Parsing', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('should parse &x sigil for local variables', () => {
    // Test compilation doesn't crash
    expect(() => {
      executeTacitCode(vm, ': test 42 var x &x drop ;');
    }).not.toThrow();
  });

  test('should differentiate between x and &x behavior', () => {
    const resultValue = executeTacitCode(vm, ': test (1 2 3) var mylist mylist ; test');
    const resultRef = executeTacitCode(vm, ': test (1 2 3) var mylist &mylist ; test');

    // They should produce different stack states
    expect(resultValue).not.toEqual(resultRef);
  });

  // Global references are disabled in this phase; top-level &global is not supported.

  test('should reject &x for undefined names at top level', () => {
    expect(() => {
      executeTacitCode(vm, '&undefined');
    }).toThrow(/Undefined word.*undefined/);
  });

  test('should reject &x for undefined variables', () => {
    expect(() => {
      executeTacitCode(vm, ': test &undefined ;');
    }).toThrow(/Undefined word.*undefined/);
  });

  test('should reject &x for non-local variables', () => {
    expect(() => {
      executeTacitCode(vm, ': helper 42 ; : test &helper ;');
    }).toThrow(/is not a local variable/);
  });
});
