import { describe, test, expect } from '@jest/globals';
import { executeTacitCode } from '../../utils/vm-test-utils';

describe('Increment operator +> (locals-only)', () => {
  describe('happy path', () => {
    test('basic increment by 1', () => {
      const result = executeTacitCode(`
        : inc1
          0 var x
          1 +> x
          x
        ;
        inc1
      `);
      expect(result).toEqual([1]);
    });

    test('multiple increments (1 then 2)', () => {
      const result = executeTacitCode(`
        : inc-multi
          5 var x
          1 +> x
          2 +> x
          x
        ;
        inc-multi
      `);
      expect(result).toEqual([8]);
    });

    test('negative and float increments', () => {
      const result = executeTacitCode(`
        : inc-float
          1.5 var x
          -0.5 +> x
          x
        ;
        inc-float
      `);
      expect(result[0]).toBeCloseTo(1.0);
    });

    test('larger increments', () => {
      const result = executeTacitCode(`
        : inc-large
          10 var x
          100 +> x
          x
        ;
        inc-large
      `);
      expect(result).toEqual([110]);
    });
  });

  describe('error cases', () => {
    test('using +> outside a function should throw', () => {
      expect(() =>
        executeTacitCode(`
          1 +> x
        `),
      ).toThrow(/Increment operator \(\+>\) only allowed inside function definitions/);
    });

    test('undefined local variable name should throw', () => {
      expect(() =>
        executeTacitCode(`
          : bad
            1 +> y
          ;
          bad
        `),
      ).toThrow(/Undefined local variable: y/);
    });

    test('bracket path increments not implemented in this stage', () => {
      expect(() =>
        executeTacitCode(`
          : bad-path
            ( 1 2 ) var xs
            1 +> xs[0]
          ;
          bad-path
        `),
      ).toThrow(/Increment on bracket paths not implemented in this stage/);
    });
  });

  describe('equivalence with sugar (value x add -> x)', () => {
    test('1 +> x equals 1 x add -> x', () => {
      const resultSugar = executeTacitCode(`
        : using-plus-greater
          10 var x
          1 +> x
          x
        ;
        using-plus-greater
      `);

      const resultDesugared = executeTacitCode(`
        : using-desugar
          10 var x
          1 x add -> x
          x
        ;
        using-desugar
      `);

      expect(resultSugar[0]).toBeCloseTo(resultDesugared[0]);
    });
  });
});
