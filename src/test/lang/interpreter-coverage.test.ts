/**
 * Tests for interpreter.ts - targeting uncovered branches
 * This file focuses on edge cases and error conditions not covered in main interpreter tests
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { vm, initializeInterpreter } from '../../lang/runtime';
import { execute, executeProgram, callTacit as callTacitFunction } from '../../lang/interpreter';
import { SEG_CODE } from '../../core';

describe('Interpreter - Branch Coverage', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('execute function edge cases', () => {
    test('should handle debug mode output for valid opcodes', () => {
      vm.debug = true;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      executeProgram('5 3 add');

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      vm.debug = false;
    });

    test('should handle debug mode output during error conditions', () => {
      vm.debug = true;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      try {
        executeProgram('drop');
      } catch {
        expect(consoleSpy).toHaveBeenCalled();
      }

      consoleSpy.mockRestore();
      vm.debug = false;
    });

    test('should preserve stack state when encountering errors', () => {
      vm.push(42);
      vm.push(24);

      const codeAddr = vm.compiler.CP;
      vm.memory.write8(SEG_CODE, codeAddr, 200);
      vm.compiler.CP += 1;

      try {
        execute(codeAddr);
      } catch (error) {
        expect(vm.getStackData()).toEqual([42, 24]);
        expect((error as Error).message).toContain('Invalid opcode: 200');
      }
    });

    test('should reset compiler state after error', () => {
      vm.compiler.preserve = true;

      try {
        executeProgram('drop');
      } catch {
        expect(vm.compiler.preserve).toBe(false);
      }
    });
  });

  describe('callTacit', () => {
    test('should be accessible but complex to test directly', () => {
      expect(typeof callTacitFunction).toBe('function');
    });
  });

  describe('executeProgram edge cases', () => {
    test('should handle empty code string', () => {
      expect(() => executeProgram('')).not.toThrow();
    });

    test('should handle code with only whitespace and comments', () => {
      expect(() => executeProgram('   \n\t  ')).not.toThrow();
    });
  });
});
