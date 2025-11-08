/**
 * Integration tests for local variables with existing Tacit features
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../core';
import { executeTacitCode } from '../utils/vm-test-utils';

describe('Local Variables Integration with Existing Features', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('Integration with basic operations', () => {
    test('should work with simple calculations', () => {
      const result = executeTacitCode(
        vm,
        `
        : simple-calc
            10 var base
            5 var increment
            base increment add
        ;
        simple-calc
      `,
      );

      expect(result).toEqual([15]);
    });
  });

  describe('Integration with control flow', () => {
    test('should work with IF/ELSE constructs', () => {
      const result = executeTacitCode(
        vm,
        `
        : test-conditional
            1 var flag
            42 var value
            flag if value 10 add else value 100 add ;
        ;
        test-conditional
      `,
      );

      // flag=1 (truthy), so should execute then branch: 42 + 10 = 52
      expect(result).toEqual([52]);
    });

    test('should work with simple conditionals and local variables', () => {
      const result = executeTacitCode(
        vm,
        `
        : simple-conditional
            5 var x
            x 3 gt if x 100 add else x 999 add ;
        ;
        simple-conditional
      `,
      );

      // x=5: 5>3 is true, so 5+100=105
      expect(result).toEqual([105]);
    });
  });

  describe('Integration with stack operations', () => {
    test('should work with dup, swap, rot operations', () => {
      const result = executeTacitCode(
        vm,
        `
        : stack-ops-test
            10 var x
            20 var y
            x y dup rot add add
        ;
        stack-ops-test
      `,
      );

      // Stack: [10, 20] -> dup -> [10, 20, 20] -> rot -> [20, 20, 10] -> add add -> [50]
      expect(result).toEqual([50]);
    });

    test('should work with basic stack operations', () => {
      const result = executeTacitCode(
        vm,
        `
        : basic-stack
            1 var a
            2 var b
            a b dup add
        ;
        basic-stack
      `,
      );

      // a=1, b=2, dup gives [1,2,2], add gives [1,4] - only one add, so result is [1,4]
      expect(result).toEqual([1, 4]);
    });
  });

  describe('Integration with arithmetic operations', () => {
    test('should work with arithmetic expressions', () => {
      const result = executeTacitCode(
        vm,
        `
        : simple-math
            2 var base
            3 var multiplier
            5 var addend
            base multiplier mul addend add
        ;
        simple-math
      `,
      );

      // 2 * 3 + 5 = 11
      expect(result).toEqual([11]);
    });

    test('should work with mathematical functions', () => {
      const result = executeTacitCode(
        vm,
        `
        : math-functions
            -25 var x
            x abs var positive
            positive sqrt
        ;
        math-functions
      `,
      );

      // abs(-25) = 25, sqrt(25) = 5
      expect(result).toEqual([5]);
    });
  });

  describe('Integration with function calls', () => {
    test('should work with function calls and local variables', () => {
      const result = executeTacitCode(
        vm,
        `
        : helper 100 add ;
        : caller
            5 var input
            input helper
        ;
        caller
      `,
      );

      // input=5, helper adds 100, result=105
      expect(result).toEqual([105]);
    });

    test('should work with multiple function calls', () => {
      const result = executeTacitCode(
        vm,
        `
        : double 2 mul ;
        : processor
            10 var base
            base double
        ;
        processor
      `,
      );

      // base=10, doubled=20
      expect(result).toEqual([20]);
    });
  });

  describe('Variable Mutation', () => {
    test('should support variable mutation using -> operator', () => {
      const result = executeTacitCode(
        vm,
        `
        : test-mutation
            42 var x
            99 -> x
            x
        ;
        test-mutation
      `,
      );

      // x initialized to 42, then mutated to 99 using -> operator
      expect(result).toEqual([99]);
    });

    test('should support multiple variable mutations with ->', () => {
      const result = executeTacitCode(
        vm,
        `
        : multi-mutation
            10 var a
            20 var b
            100 -> a
            200 -> b
            a b add
        ;
        multi-mutation
      `,
      );

      // a=10→100, b=20→200, sum=300
      expect(result).toEqual([300]);
    });

    test('should support mutation and reading in sequence with ->', () => {
      const result = executeTacitCode(
        vm,
        `
        : sequence-test
            5 var counter
            counter 10 add -> counter
            counter 2 mul -> counter
            counter
        ;
        sequence-test
      `,
      );

      // counter=5, then 5+10=15, then 15*2=30
      expect(result).toEqual([30]);
    });
  });
});
