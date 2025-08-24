/**
 * Error handling and validation tests for local variables
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../core/globalState';
import { executeTacitCode } from '../utils/vm-test-utils';
import { SyntaxError, UndefinedWordError } from '../../core/errors';

describe('Local Variables Error Handling', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('Variable declaration validation', () => {
    test('should reject variable declarations outside functions', () => {
      expect(() => {
        executeTacitCode('42 var x');
      }).toThrow(SyntaxError);
    });

    test('should reject invalid variable names', () => {
      expect(() => {
        executeTacitCode(': test 42 var 123 ;');
      }).toThrow(SyntaxError);
    });

    test('should reject var without name', () => {
      expect(() => {
        executeTacitCode(': test 42 var ;');
      }).toThrow(SyntaxError);
    });
  });

  describe('Variable reference validation', () => {
    test('should handle undefined variable references gracefully', () => {
      expect(() => {
        executeTacitCode(`
          : test-undefined
              nonexistent
          ;
          test-undefined
        `);
      }).toThrow(UndefinedWordError);
    });

    test('should handle variables that go out of scope', () => {
      // Variables should only be accessible within their defining function
      // This should work fine - each function call gets its own frame
      const result = executeTacitCode(`
        : define-var 42 var x x ;
        : use-builtin 999 ;
        define-var
        use-builtin
      `);
      
      // define-var returns its local variable value, use-builtin returns 999
      expect(result).toEqual([42, 999]);
    });
  });

  describe('Memory and stack validation', () => {
    test('should handle functions with many variables without crashing', () => {
      // Test with a reasonable number of variables (50)
      const manyVarCode = `: many-vars
        ${Array.from({length: 50}, (_, i) => `${i} var v${i}`).join(' ')}
        v0 v49 add
      ;
      many-vars`;
      
      const result = executeTacitCode(manyVarCode);
      expect(result).toEqual([49]); // 0 + 49
    });

    test('should handle empty functions with variable declarations', () => {
      const result = executeTacitCode(`
        : empty-with-vars
            42 var x
        ;
        empty-with-vars
      `);
      
      // Function declares variable but doesn't use it
      expect(result).toEqual([]);
    });

    test('should handle functions that declare but never reference variables', () => {
      const result = executeTacitCode(`
        : unused-vars
            1 var a
            2 var b  
            3 var c
            999
        ;
        unused-vars
      `);
      
      expect(result).toEqual([999]);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    test('should handle zero values in variables', () => {
      const result = executeTacitCode(`
        : zero-test
            0 var zero
            zero zero add
        ;
        zero-test
      `);
      
      expect(result).toEqual([0]);
    });

    test('should handle negative values', () => {
      const result = executeTacitCode(`
        : negative-test
            -100 var neg
            neg abs
        ;
        negative-test
      `);
      
      expect(result).toEqual([100]);
    });

    test('should handle large numbers', () => {
      const result = executeTacitCode(`
        : large-test
            1000000 var big
            big 2 mul
        ;
        large-test
      `);
      
      expect(result).toEqual([2000000]);
    });

    test('should handle variable shadowing edge cases', () => {
      // Define a global using a valid builtin opcode (Add = 5)
      vm.symbolTable.defineBuiltin('global_var', 5);
      
      const result = executeTacitCode(`
        : shadow-test
            42 var global_var
            global_var
        ;
        shadow-test
      `);
      
      // Local should shadow global
      expect(result).toEqual([42]);
    });

    test('should handle rapid variable declaration and access', () => {
      const result = executeTacitCode(`
        : rapid-test
            1 var a a
            2 var b b  
            3 var c c
        ;
        rapid-test
      `);
      
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('Integration error handling', () => {
    test('should handle variables with arithmetic operations', () => {
      const result = executeTacitCode(`
        : math-test
            10 var x
            5 var y
            x y div
        ;
        math-test
      `);
      
      expect(result).toEqual([2]); // 10 / 5
    });

    test('should handle variables with stack operations', () => {
      const result = executeTacitCode(`
        : stack-test
            1 var x
            2 var y
            x y x
        ;
        stack-test
      `);
      
      expect(result).toEqual([1, 2, 1]);
    });

    test('should handle variables in nested function calls', () => {
      const result = executeTacitCode(`
        : inner 100 add ;
        : outer 
            50 var base
            base inner
        ;
        outer
      `);
      
      expect(result).toEqual([150]); // 50 + 100
    });
  });
});