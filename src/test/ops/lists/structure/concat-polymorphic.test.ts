/**
 * Tests for polymorphic concat operation
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { executeTacitCode } from '../../../utils/vm-test-utils';
import { createVM, VM } from '../../../../core';

describe('Polymorphic concat Operation', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('Type dispatch verification', () => {
    test('simple + simple should create 2-element list', () => {
      const result = executeTacitCode(vm, '5 3 concat');
      const expected = executeTacitCode(vm, '( 5 3 )');
      expect(result).toEqual(expected);
    });

    test('list + simple should append (O1 efficient)', () => {
      const result = executeTacitCode(vm, '( 1 2 ) 3 concat');
      const expected = executeTacitCode(vm, '( 1 2 3 )');
      expect(result).toEqual(expected);
    });

    test('simple + list should prepend', () => {
      const result = executeTacitCode(vm, '5 ( 1 2 ) concat');
      const expected = executeTacitCode(vm, '( 5 1 2 )');
      expect(result).toEqual(expected);
    });

    test('list + list should concatenate', () => {
      const result = executeTacitCode(vm, '( 1 2 ) ( 3 4 ) concat');
      const expected = executeTacitCode(vm, '( 1 2 3 4 )');
      expect(result).toEqual(expected);
    });
  });

  describe('Edge cases', () => {
    test('empty list + simple should work', () => {
      const result = executeTacitCode(vm, '( ) 5 concat');
      const expected = executeTacitCode(vm, '( 5 )');
      expect(result).toEqual(expected);
    });

    test('simple + empty list should work', () => {
      const result = executeTacitCode(vm, '5 ( ) concat');
      const expected = executeTacitCode(vm, '( 5 )');
      expect(result).toEqual(expected);
    });

    test('empty + empty should work', () => {
      const result = executeTacitCode(vm, '( ) ( ) concat');
      const expected = executeTacitCode(vm, '( )');
      expect(result).toEqual(expected);
    });
  });

  describe('Comparison with existing operations', () => {
    test('simple+simple should match manual list creation', () => {
      const ccatResult = executeTacitCode(vm, '7 8 concat');
      const manualResult = executeTacitCode(vm, '( 7 8 )');
      expect(ccatResult).toEqual(manualResult);
    });

    test('list+simple should be equivalent to existing append-like behavior', () => {
      // This tests the O(1) append efficiency
      const ccatResult = executeTacitCode(vm, '( 10 20 ) 30 concat');
      const expectedResult = executeTacitCode(vm, '( 10 20 30 )');
      expect(ccatResult).toEqual(expectedResult);
    });

    test('simple+list should match prepend behavior', () => {
      const ccatResult = executeTacitCode(vm, '99 ( 1 2 3 ) concat');
      const expected = executeTacitCode(vm, '( 99 1 2 3 )');
      expect(ccatResult).toEqual(expected);
    });
  });
});
