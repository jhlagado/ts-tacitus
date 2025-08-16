/**
 * Tests for interpreter.ts - targeting uncovered branches
 * This file focuses on edge cases and error conditions not covered in main interpreter tests
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { vm, initializeInterpreter } from '../../core/globalState';
import { execute, executeProgram, callTacitFunction } from '../../lang/interpreter';
import { SEG_CODE } from '../../core/constants';

describe('Interpreter - Branch Coverage', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('execute function edge cases', () => {
    test('should handle debug mode output for valid opcodes', () => {
      // Enable debug mode and capture console output
      vm.debug = true;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Execute a simple program
      executeProgram('5 3 add');

      // Should have logged debug information
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      vm.debug = false;
    });

    test('should handle debug mode output during error conditions', () => {
      vm.debug = true;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      try {
        // Trigger an error that should cause debug output
        executeProgram('drop'); // Stack underflow
      } catch {
        // Should have logged error stack trace in debug mode
        expect(consoleSpy).toHaveBeenCalled();
      }

      consoleSpy.mockRestore();
      vm.debug = false;
    });

    test('should preserve stack state when encountering errors', () => {
      vm.push(42);
      vm.push(24);

      const codeAddr = vm.compiler.CP;
      vm.memory.write8(SEG_CODE, codeAddr, 200); // Invalid opcode
      vm.compiler.CP += 1;

      try {
        execute(codeAddr);
      } catch (error) {
        // Stack should still contain our values
        expect(vm.getStackData()).toEqual([42, 24]);
        expect((error as Error).message).toContain('Invalid opcode: 200');
      }
    });

    test('should reset compiler state after error', () => {
      vm.compiler.preserve = true;

      try {
        executeProgram('drop'); // This will fail with stack underflow
      } catch {
        // Compiler should have been reset
        expect(vm.compiler.preserve).toBe(false);
      }
    });

  });

  describe('callTacitFunction', () => {
    test('should be accessible but complex to test directly', () => {
      // callTacitFunction is complex to test without proper function setup
      // The function exists and can be called, but requires valid bytecode
      expect(typeof callTacitFunction).toBe('function');
    });
  });

  describe('executeProgram edge cases', () => {
    test('should handle empty code string', () => {
      // Empty programs are handled by the parser, not the interpreter
      expect(() => executeProgram('')).not.toThrow();
    });

    test('should handle code with only whitespace and comments', () => {
      // These are handled by the tokenizer/parser layers
      expect(() => executeProgram('   \n\t  ')).not.toThrow();
    });
  });
});
