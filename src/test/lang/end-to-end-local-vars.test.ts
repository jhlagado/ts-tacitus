/**
 * End-to-end integration tests for complete local variable system
 * Tests complete workflow: Parse → Compile → Execute
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../core/globalState';
import { executeTacitCode } from '../utils/vm-test-utils';

describe('End-to-End Local Variables Integration', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('Complete function compilation and execution', () => {
    test('should compile and execute function without variables first', () => {
      const result = executeTacitCode(`
        : no-vars
            42
        ;
        no-vars
      `);

      expect(result).toEqual([42]);
    });

    test('should compile and execute function with simple locals', () => {
      const result = executeTacitCode(`
        : simple-test
            42 var x
            x
        ;
        simple-test
      `);

      // Should just return the variable value
      expect(result).toEqual([42]);
    });

    test('should handle multiple functions with different variable counts', () => {
      const result = executeTacitCode(`
        : add-two 
            var x
            2 var increment 
            x increment add 
        ;
        : multiply-three 
            var x
            3 var factor 
            x factor mul 
        ;
        : no-vars 42 ;
        
        5 add-two    
        4 multiply-three
        no-vars
      `);

      // Stack should have: [7, 12, 42]
      expect(result).toEqual([7, 12, 42]);
    });

    test('should handle variable shadowing correctly', () => {
      // Define a global-like builtin first
      vm.symbolTable.defineBuiltin('x', 99);

      const result = executeTacitCode(`
        : test-shadow
            10 var x
            x
        ;
        test-shadow
      `);

      expect(result).toEqual([10]); // Local x (10), not global x (99)
    });

    test('should handle nested function calls with locals', () => {
      const result = executeTacitCode(`
        : inner 
            var x
            1 var offset 
            x offset add 
        ;
        : outer 
            10 var base 
            base inner 
        ;
        
        5 outer
      `);

      // outer: base=10, calls inner with 5 still on stack
      // inner: x=10 (from base), offset=1, computes 10+1=11
      // Result: original 5 + computed 11
      expect(result).toEqual([5, 11]);
    });
  });

  describe('Reserve back-patching verification', () => {
    test('should emit correct Reserve opcode for functions with variables', () => {
      // This test verifies that Reserve back-patching works correctly
      // by checking that functions with different numbers of variables
      // execute correctly (which wouldn't work if Reserve was wrong)

      const result = executeTacitCode(`
        : one-var 42 var x x ;
        : two-vars 10 var a 20 var b a b add ;
        : three-vars 1 var x 2 var y 3 var z x y z add add ;
        
        one-var
        two-vars  
        three-vars
      `);

      expect(result).toEqual([42, 30, 6]);
    });

    test('should handle functions without variables (no Reserve)', () => {
      const result = executeTacitCode(`
        : no-vars-1 100 ;
        : no-vars-2 2 3 add ;
        : with-vars 1 var x x ;
        
        no-vars-1
        no-vars-2
        5 with-vars
      `);

      expect(result).toEqual([100, 5, 5, 1]);
    });
  });

  describe('Complex variable operations', () => {
    test('should handle variable reuse and modification', () => {
      const result = executeTacitCode(`
        : calculate
            5 var x
            x 10 add var y
            x y mul
        ;
        calculate
      `);

      // x = 5, y = x + 10 = 15, result = x * y = 5 * 15 = 75
      expect(result).toEqual([75]);
    });

    test('should work with floating point variables', () => {
      const result = executeTacitCode(`
        : area
            3.14 var pi
            2.5 var radius
            pi radius radius mul mul
        ;
        area
      `);

      // pi * radius^2 = 3.14 * 2.5 * 2.5 = 19.625
      expect(result[0]).toBeCloseTo(19.625);
    });

    test('should handle negative values', () => {
      const result = executeTacitCode(`
        : negative-math
            -10 var neg
            5 var pos
            neg pos add
        ;
        negative-math
      `);

      expect(result).toEqual([-5]); // -10 + 5 = -5
    });
  });

  describe('Integration with existing operations', () => {
    test('should work with stack operations', () => {
      const result = executeTacitCode(`
        : stack-test
            1 2 3 var c var b var a
            a b c
        ;
        stack-test
      `);

      // Variables: a=1, b=2, c=3 (var pops from top of stack)
      // Result: push a, b, c = [1, 2, 3]
      expect(result).toEqual([1, 2, 3]);
    });

    test('should work with arithmetic operations', () => {
      const result = executeTacitCode(`
        : arithmetic
            10 var x
            5 var y
            x y add
            x y sub
            x y mul
        ;
        arithmetic
      `);

      expect(result).toEqual([15, 5, 50]);
    });

    test('should work with conditional operations', () => {
      const result = executeTacitCode(`
        : conditional
            1 var flag
            flag IF { 42 } ELSE { 0 }
        ;
        conditional
      `);

      expect(result).toEqual([42]); // flag is 1 (truthy), so 42
    });
  });

  describe('Error handling and edge cases', () => {
    test('should handle zero values', () => {
      const result = executeTacitCode(`
        : zero-test
            0 var zero
            zero
        ;
        zero-test
      `);

      expect(result).toEqual([0]);
    });

    test('should handle large numbers', () => {
      const result = executeTacitCode(`
        : large-nums
            1000000 var million
            million 2 mul
        ;
        large-nums
      `);

      expect(result).toEqual([2000000]);
    });

    test('should isolate variables between function calls', () => {
      const result = executeTacitCode(`
        : test-isolation
            99 var x
            x
        ;
        
        test-isolation
        test-isolation
      `);

      expect(result).toEqual([99, 99]); // Both calls independent
    });
  });

  describe('Performance and stress testing', () => {
    test('should handle many variables efficiently', () => {
      const result = executeTacitCode(`
        : many-vars
            1 var v1 2 var v2 3 var v3 4 var v4 5 var v5
            6 var v6 7 var v7 8 var v8 9 var v9 10 var v10
            v1 v2 add v3 add v4 add v5 add
            v6 add v7 add v8 add v9 add v10 add
        ;
        many-vars
      `);

      // Sum of 1+2+3+4+5+6+7+8+9+10 = 55
      expect(result).toEqual([55]);
    });

    test('should handle recursive-style operations', () => {
      const result = executeTacitCode(`
        : accumulate
            0 var acc
            1 var i
            acc i add var acc
            acc i add var acc  
            acc i add var acc
            acc
        ;
        accumulate
      `);

      // acc starts at 0, adds 1 three times = 3
      expect(result).toEqual([3]);
    });
  });
});
