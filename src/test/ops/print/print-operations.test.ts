/**
 * Comprehensive print operations tests - Consolidation of print.test.ts and raw-print.test.ts
 * Tests both high-level '.' operation and low-level 'raw' operator
 */
import { Tag, toTaggedValue } from '@src/core';
import { vm } from '@src/core/global-state';
import { printOp, rawPrintOp } from '@src/ops/print/print-ops';
import { resetVM, captureTacitOutput } from '../../utils/vm-test-utils';
import { STACK_BASE, CELL_SIZE } from '@src/core/constants';

describe('Print Operations', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('High-level print operation', () => {
    describe('simple values', () => {
      test('should print atomic values correctly', () => {
        const output = captureTacitOutput('123 .');
        expect(output).toEqual(['123']);

        const floatOutput = captureTacitOutput('3.14 .');
        expect(floatOutput).toEqual(['3.14']);
      });
    });

    describe('list operations', () => {
      test('should print simple lists correctly', () => {
        const output = captureTacitOutput('( 1 2 ) .');
        expect(output).toEqual(['( 1 2 )']);
      });

      test('should print nested lists correctly', () => {
        const output = captureTacitOutput('( 1 ( 2 3 ) 4 ) .');
        expect(output).toEqual(['( 1 ( 2 3 ) 4 )']);

        const deepOutput = captureTacitOutput('( 1 ( 2 ( 3 4 ) 5 ) 6 ) .');
        expect(deepOutput).toEqual(['( 1 ( 2 ( 3 4 ) 5 ) 6 )']);
      });
    });

    describe('error cases', () => {
      test('should handle empty stack for print operation', () => {
        const output = captureTacitOutput('.');
        expect(output).toEqual(['[Error: Stack empty]']);
      });
    });

    describe('integration tests', () => {
      test('should handle multiple print operations', () => {
        const output = captureTacitOutput('123 . 456 .');
        expect(output.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Low-level raw print operation (raw)', () => {
    describe('simple values', () => {
      test('should print a simple number', () => {
        const output = captureTacitOutput('42 raw');
        expect(output[0]).toBe('42');
      });

      test('should print multiple simple values', () => {
        const output = captureTacitOutput('42 raw 84 raw');
        expect(output).toContain('42');
        expect(output).toContain('84');
      });
    });

    describe('list operations', () => {
      test('should print a tagged value', () => {
        const output = captureTacitOutput('(1 2) raw');
        expect(output[0]).toMatch(/^LIST:\d+/);
      });

      test('should handle complex list structures', () => {
        const output = captureTacitOutput('( 1 ( 2 3 ) 4 ) raw');
        expect(output.length).toBeGreaterThan(0);
      });
    });

    describe('error cases', () => {
      test('should handle empty stack', () => {
        const output = captureTacitOutput('raw');
        expect(output[0]).toContain('Stack empty');
      });

      test('should handle multiple empty stack attempts', () => {
        const output = captureTacitOutput('raw raw');
        expect(output.every(line => line.includes('Stack empty'))).toBe(true);
      });
    });

    describe('integration tests', () => {
      test('should work with arithmetic operations', () => {
        const output = captureTacitOutput('5 3 add raw');
        expect(output[0]).toBe('8');
      });

      test('should work with stack operations', () => {
        const output = captureTacitOutput('42 dup raw raw');
        expect(output).toEqual(['42', '42']);
      });

      test('should handle mixed print and raw print operations', () => {
        const output = captureTacitOutput('123 raw 456 .');
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
      resetVM();
      vm.push(42);
      const originalPop = vm.pop.bind(vm);
      const popSpy = jest.spyOn(vm, 'pop');
      popSpy.mockImplementationOnce(() => {
        throw new Error('pop fail');
      });
      popSpy.mockImplementation(originalPop);

      printOp(vm);

  expect(logSpy).toHaveBeenCalledWith('[Print error: pop fail]');
  expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(0);

      popSpy.mockRestore();
      resetVM();
    });

    test('rawPrintOp handles unexpected errors gracefully', () => {
      resetVM();
      vm.push(toTaggedValue(1, Tag.NUMBER));
      const popSpy = jest.spyOn(vm, 'pop').mockImplementation(() => {
        throw new Error('boom');
      });

      rawPrintOp(vm);

  expect(logSpy).toHaveBeenCalledWith('[Raw print error: boom]');
  expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(1);

      popSpy.mockRestore();
      resetVM();
    });
  });
});
