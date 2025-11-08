import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../core';
import {
  testTacitCode,
  executeTacitCode,
  runTacitTest,
  captureTacitOutput,
} from './utils/vm-test-utils';

describe('tacitTestUtils', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });
  describe('testTacitCode', () => {
    test('should validate stack output correctly', () => {
      expect(() => testTacitCode(vm, '5 3 add', [8])).not.toThrow();
    });
    test('should throw error for stack length mismatch', () => {
      expect(() => testTacitCode(vm, '5 3 add', [8, 1])).toThrow(/Stack length mismatch/);
    });
    test('should throw error for value mismatch', () => {
      expect(() => testTacitCode(vm, '5 3 add', [7])).toThrow(/Stack value mismatch/);
    });
    test('should handle floating-point precision', () => {
      expect(() => testTacitCode(vm, '0.1 0.2 add', [0.3])).not.toThrow();
    });
    test('should throw error for NaN values', () => {
      expect(() => testTacitCode(vm, 'NaN', [NaN])).toThrow('Undefined word: NaN');
    });
    test('should throw error for non-numeric stack values', () => {
      expect(() => testTacitCode(vm, '5', ['string'] as unknown as number[])).toThrow(
        /Stack value is NaN at position 0: expected string, got 5/,
      );
    });
  });
  describe('executeTacitCode', () => {
    test('should execute Tacit code and return stack', () => {
      const result = executeTacitCode(vm, '5 3 add');
      expect(result).toEqual([8]);
    });
    test('should handle empty code', () => {
      const result = executeTacitCode(vm, '');
      expect(result).toEqual([]);
    });
    test('should handle complex stack operations', () => {
      const result = executeTacitCode(vm, '1 2 3 drop swap dup');
      expect(result).toEqual([2, 1, 1]);
    });
  });
  describe('captureTacitOutput', () => {
    test('should capture console output', () => {
      const output = captureTacitOutput(vm, '5 raw');
      expect(output).toEqual(['5']);
    });
    test('should handle multiple outputs', () => {
      const output = captureTacitOutput(vm, '5 3 add raw');
      expect(output).toEqual(['8']);
    });
    test('should handle empty output', () => {
      const output = captureTacitOutput(vm, '');
      expect(output).toEqual([]);
    });
  });
  describe('runTacitTest', () => {
    test('should execute Tacit code and return stack state', () => {
      const result = runTacitTest(vm, '5 3 add');
      expect(result).toEqual([8]);
    });
    test('should handle complex stack operations', () => {
      const result = runTacitTest(vm, '1 2 3 drop swap dup');
      expect(result).toEqual([2, 1, 1]);
    });
    test('should handle empty input', () => {
      const result = runTacitTest(vm, '');
      expect(result).toEqual([]);
    });
  });
});
