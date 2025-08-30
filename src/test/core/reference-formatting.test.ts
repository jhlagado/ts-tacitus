import { describe, test, expect, beforeEach } from '@jest/globals';
import { resetVM, executeTacitCode } from '../utils/vm-test-utils';

describe('Reference Formatting', () => {
  beforeEach(() => {
    resetVM();
  });

  test('should format local variable references correctly', () => {
    // Test local variable reference (RSTACK_REF from var operation) - use Tacit code with print
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      executeTacitCode(`
        : test-local-ref (1 2 3) var x x . ;
        test-local-ref
      `);

      // Should print the actual list content, not metadata
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('( 1 2 3 )');
    } finally {
      consoleSpy.mockRestore();
    }
  });

  test('should format the original f2 case correctly', () => {
    // This is the test case that was originally failing: f2 should show ( 1 2 ), not ( 2 1 )
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      executeTacitCode(': f2 (1 2) var x x . ; f2');

      // Should print the correct list content in the right order
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('( 1 2 )');
    } finally {
      consoleSpy.mockRestore();
    }
  });

  test('should handle non-list references correctly', () => {
    // Test reference to a simple value (should format as the value)
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      executeTacitCode(`
        : test-simple-ref 42 var x x . ;
        test-simple-ref
      `);

      // Should print the simple value correctly
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('42');
    } finally {
      consoleSpy.mockRestore();
    }
  });

  test('should print references correctly via print operation', () => {
    // Test actual console output from print operations
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      // Test the f2 case - should print ( 1 2 ), not ( 2 1 ) or metadata
      executeTacitCode(': f2 (1 2) var x x . ; f2');

      // Should have called console.log once with the correct output
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('( 1 2 )');

      consoleSpy.mockClear();

      // Test different list size
      executeTacitCode(': f3 (1 2 3 4) var x x . ; f3');
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('( 1 2 3 4 )');

      consoleSpy.mockClear();

      // Test simple value reference
      executeTacitCode(': f4 42 var x x . ; f4');
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('42');
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
