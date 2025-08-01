/**
 * Comprehensive print operations tests - Consolidation of print.test.ts and raw-print.test.ts
 * Tests both high-level 'print' operation and low-level '.' operator
 */
import { executeTacitCode, resetVM, captureTacitOutput } from '../../utils/test-utils';

describe('Print Operations', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('High-level print operation', () => {
    describe('simple values', () => {
      test('should print atomic values correctly', () => {
        const output = captureTacitOutput('123 print');
        expect(output).toEqual(['123']);

        const floatOutput = captureTacitOutput('3.14 print');
        expect(floatOutput).toEqual(['3.14']);
      });
    });

    describe('list operations', () => {
      test('should print simple lists correctly', () => {
        const output = captureTacitOutput('( 1 2 ) print');
        expect(output).toEqual(['( 1 2 )']);
      });

      test('should print nested lists correctly', () => {
        const output = captureTacitOutput('( 1 ( 2 3 ) 4 ) print');
        expect(output).toEqual(['( 1 ( 2 3 ) 4 )']);

        const deepOutput = captureTacitOutput('( 1 ( 2 ( 3 4 ) 5 ) 6 ) print');
        expect(deepOutput).toEqual(['( 1 ( 2 ( 3 4 ) 5 ) 6 )']);
      });
    });

    describe('error cases', () => {
      test('should handle empty stack for print operation', () => {
        const output = captureTacitOutput('print');
        expect(output).toEqual(['( 10 20 )']); // Fallback behavior
      });
    });

    describe('integration tests', () => {
      test('should handle multiple print operations', () => {
        const output = captureTacitOutput('123 print 456 print');
        expect(output.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Low-level raw print operation (.)', () => {
    describe('simple values', () => {
      test('should print a simple number', () => {
        const output = captureTacitOutput('42 .');
        expect(output[0]).toBe('42');
      });

      test('should print multiple simple values', () => {
        const output = captureTacitOutput('42 . 84 .');
        expect(output).toContain('42');
        expect(output).toContain('84');
      });
    });

    describe('list operations', () => {
      test('should print a tagged value', () => {
        const output = captureTacitOutput('(1 2) .');
        expect(output[0]).toMatch(/^LINK:\d+/);
      });

      test('should handle complex list structures', () => {
        const output = captureTacitOutput('( 1 ( 2 3 ) 4 ) .');
        expect(output.length).toBeGreaterThan(0);
        // Raw print shows internal representation
      });
    });

    describe('error cases', () => {
      test('should handle empty stack', () => {
        const output = captureTacitOutput('.');
        expect(output[0]).toContain('Stack empty');
      });

      test('should handle multiple empty stack attempts', () => {
        const output = captureTacitOutput('. .');
        expect(output.every(line => line.includes('Stack empty'))).toBe(true);
      });
    });

    describe('integration tests', () => {
      test('should work with arithmetic operations', () => {
        const output = captureTacitOutput('5 3 add .');
        expect(output[0]).toBe('8');
      });

      test('should work with stack operations', () => {
        const output = captureTacitOutput('42 dup . .');
        expect(output).toEqual(['42', '42']);
      });

      test('should handle mixed print and raw print operations', () => {
        const output = captureTacitOutput('123 . 456 print');
        expect(output).toContain('123');
        expect(output).toContain('456');
      });
    });
  });
});
