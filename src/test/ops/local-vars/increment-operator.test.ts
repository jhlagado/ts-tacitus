import { describe, test, expect, beforeEach } from '@jest/globals';
import { executeTacitCode } from '../../utils/vm-test-utils';
import { createVM, type VM } from '../../../core/vm';

describe('Increment operator +> (locals-only)', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('happy path', () => {
    test('basic increment by 1', () => {
      const result = executeTacitCode(
        vm,
        `
        : inc1
          0 var x
          1 +> x
          x
        ;
        inc1
      `,
      );
      expect(result).toEqual([1]);
    });

    test('multiple increments (1 then 2)', () => {
      const result = executeTacitCode(
        vm,
        `
        : inc-multi
          5 var x
          1 +> x
          2 +> x
          x
        ;
        inc-multi
      `,
      );
      expect(result).toEqual([8]);
    });

    test('negative and float increments', () => {
      const result = executeTacitCode(
        vm,
        `
        : inc-float
          1.5 var x
          -0.5 +> x
          x
        ;
        inc-float
      `,
      );
      expect(result[0]).toBeCloseTo(1.0);
    });

    test('larger increments', () => {
      const result = executeTacitCode(
        vm,
        `
        : inc-large
          10 var x
          100 +> x
          x
        ;
        inc-large
      `,
      );
      expect(result).toEqual([110]);
    });
  });

  describe('error cases', () => {
    test('using +> outside a function should throw', () => {
      expect(() =>
        executeTacitCode(
          vm,
          `
          1 +> x
        `,
        ),
      ).toThrow(/Increment operator \(\+>\) only allowed inside function definitions/);
    });

    test('undefined local variable name should throw', () => {
      expect(() =>
        executeTacitCode(
          vm,
          `
          : bad
            1 +> y
          ;
          bad
        `,
        ),
      ).toThrow(/Undefined local variable: y/);
    });

    // No specific error for bracketed +> anymore; covered by positive tests below
  });

  describe('equivalence with sugar (value x add -> x)', () => {
    test('1 +> x equals 1 x add -> x', () => {
      const resultSugar = executeTacitCode(
        vm,
        `
        : using-plus-greater
          10 var x
          1 +> x
          x
        ;
        using-plus-greater
      `,
      );

      const resultDesugared = executeTacitCode(
        vm,
        `
        : using-desugar
          10 var x
          1 x add -> x
          x
        ;
        using-desugar
      `,
      );

      expect(resultSugar[0]).toBeCloseTo(resultDesugared[0]);
    });
  });

  describe('bracket path increments', () => {
    test('parity with desugared form on bracket path', () => {
      const sugar = executeTacitCode(
        vm,
        `
        : using-plus-greater-br
          ( 10 20 ) var xs
          7 +> xs[0]
          xs
        ;
        using-plus-greater-br
      `,
      );

      const desugared = executeTacitCode(
        vm,
        `
        : using-desugar-br
          ( 10 20 ) var xs
          7 xs[0] add -> xs[0]
          xs
        ;
        using-desugar-br
      `,
      );

      expect(sugar).toEqual(desugared);
    });
  });
});
