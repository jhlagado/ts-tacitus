/**
 * Comprehensive print operations tests - Consolidation of print.test.ts and raw-print.test.ts
 * Tests both high-level '.' operation and low-level 'raw' operator
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { Tag, Tagged, createVM, VM } from '../../../core';
import { printOp, rawPrintOp } from '../../../ops/print/print-ops';
import { captureTacitOutput } from '../../utils/vm-test-utils';
import { STACK_BASE, CELL_SIZE } from '../../../core/constants';
import { push, pop } from '../../../core/vm';
import * as vmFunctions from '../../../core/vm';

describe('Print Operations', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('High-level print operation', () => {
    describe('simple values', () => {
      test('should print atomic values correctly', () => {
        const output = captureTacitOutput(vm, '123 .');
        expect(output).toEqual(['123']);

        const floatOutput = captureTacitOutput(vm, '3.14 .');
        expect(floatOutput).toEqual(['3.14']);
      });
    });

    describe('list operations', () => {
      test('should print simple lists correctly', () => {
        const output = captureTacitOutput(vm, '( 1 2 ) .');
        expect(output).toEqual(['( 1 2 )']);
      });

      test('should print nested lists correctly', () => {
        const output = captureTacitOutput(vm, '( 1 ( 2 3 ) 4 ) .');
        expect(output).toEqual(['( 1 ( 2 3 ) 4 )']);

        const deepOutput = captureTacitOutput(vm, '( 1 ( 2 ( 3 4 ) 5 ) 6 ) .');
        expect(deepOutput).toEqual(['( 1 ( 2 ( 3 4 ) 5 ) 6 )']);
      });
    });

    describe('error cases', () => {
      test('should handle empty stack for print operation', () => {
        const output = captureTacitOutput(vm, '.');
        expect(output).toEqual(['[Error: Stack empty]']);
      });
    });

    describe('integration tests', () => {
      test('should handle multiple print operations', () => {
        const output = captureTacitOutput(vm, '123 . 456 .');
        expect(output.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Low-level raw print operation (raw)', () => {
    describe('simple values', () => {
      test('should print a simple number', () => {
        const output = captureTacitOutput(vm, '42 raw');
        expect(output[0]).toBe('42');
      });

      test('should print multiple simple values', () => {
        const output = captureTacitOutput(vm, '42 raw 84 raw');
        expect(output).toContain('42');
        expect(output).toContain('84');
      });
    });

    describe('list operations', () => {
      test('should print a tagged value', () => {
        const output = captureTacitOutput(vm, '(1 2) raw');
        expect(output[0]).toMatch(/^LIST:\d+/);
      });

      test('should handle complex list structures', () => {
        const output = captureTacitOutput(vm, '( 1 ( 2 3 ) 4 ) raw');
        expect(output.length).toBeGreaterThan(0);
      });
    });

    describe('error cases', () => {
      test('should handle empty stack', () => {
        const output = captureTacitOutput(vm, 'raw');
        expect(output[0]).toContain('Stack empty');
      });

      test('should handle multiple empty stack attempts', () => {
        const output = captureTacitOutput(vm, 'raw raw');
        expect(output.every(line => line.includes('Stack empty'))).toBe(true);
      });
    });

    describe('integration tests', () => {
      test('should work with arithmetic operations', () => {
        const output = captureTacitOutput(vm, '5 3 add raw');
        expect(output[0]).toBe('8');
      });

      test('should work with stack operations', () => {
        const output = captureTacitOutput(vm, '42 dup raw raw');
        expect(output).toEqual(['42', '42']);
      });

      test('should handle mixed print and raw print operations', () => {
        const output = captureTacitOutput(vm, '123 raw 456 .');
        expect(output).toContain('123');
        expect(output).toContain('456');
      });
    });
  });

  describe('Direct invocation edge cases', () => {
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
      logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    test('printOp reports formatter failures and leaves stack consistent', () => {
      push(vm, 42);
      const originalPop = pop;
      const popSpy = jest.spyOn(vmFunctions, 'pop');
      popSpy.mockImplementationOnce(() => {
        throw new Error('pop fail');
      });
      popSpy.mockImplementation(originalPop);

      printOp(vm);

      expect(logSpy).toHaveBeenCalledWith('[Print error: pop fail]');
      expect(vm.sp - STACK_BASE).toBe(0);

      popSpy.mockRestore();
    });

    test('rawPrintOp handles unexpected errors gracefully', () => {
      push(vm, Tagged(1, Tag.NUMBER));
      const popSpy = jest.spyOn(vmFunctions, 'pop').mockImplementation(() => {
        throw new Error('boom');
      });

      rawPrintOp(vm);

      expect(logSpy).toHaveBeenCalledWith('[Raw print error: boom]');
      expect(vm.sp - STACK_BASE).toBe(1);

      popSpy.mockRestore();
    });
  });
});
