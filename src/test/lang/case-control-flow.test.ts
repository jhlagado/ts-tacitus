import { describe, test, expect, beforeEach } from '@jest/globals';
import { Tokenizer } from '../../lang/tokenizer';
import { parse } from '../../lang/parser';
import { ensureNoOpenConditionals } from '../../lang/meta';
import { createVM, VM } from '../../core';
import { executeTacitCode } from '../utils/vm-test-utils';
import { getStackData } from '../../core/vm';

describe('case control flow', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('executes matching clause and consumes the discriminant', () => {
    const stack = executeTacitCode(
      vm,
      `
      42 case
        42 of 111 ;
      ;
    `,
    );

    expect(stack).toEqual([111]);
  });

  test('falls back to default when no predicates match', () => {
    const stack = executeTacitCode(
      vm,
      `
      3 case
        1 of 111 ;
        DEFAULT of 222 ;
      ;
    `,
    );

    expect(stack).toEqual([222]);
  });

  test('supports multiple clauses with shared exit and default', () => {
    const program = `
      case
        -1 of 111 ;
        0 of 222 ;
        DEFAULT of 333 ;
      ;
    `;

    const negative = executeTacitCode(vm, `-1 ${program}`);
    expect(negative).toEqual([111]);

    const zero = executeTacitCode(vm, `0 ${program}`);
    expect(zero).toEqual([222]);

    const other = executeTacitCode(vm, `5 ${program}`);
    expect(other).toEqual([333]);
  });

  test('allows nested case constructs inside clause bodies', () => {
    const program = `
      case
        0 of
          1 case
            1 of 999 ;
            DEFAULT of 100 ;
          ;
        ;
        DEFAULT of 200 ;
      ;
    `;

    const nestedMatch = executeTacitCode(vm, `0 ${program}`);
    expect(nestedMatch).toEqual([999]);

    const nestedDefault = executeTacitCode(vm, `5 ${program}`);
    expect(nestedDefault).toEqual([200]);
  });

  test('first DEFAULT wins when multiple defaults are present', () => {
    const stack = executeTacitCode(
      vm,
      `
      7 case
        DEFAULT of 10 ;
        DEFAULT of 20 ;
      ;
    `,
    );

    expect(stack).toEqual([10]);
  });

  test('raises when of appears without a surrounding case', () => {
    expect(() => parse(vm, new Tokenizer('1 of 2 ;'))).toThrow("'of' without open case");
  });

  test('detects unclosed case constructs during final validation', () => {
    try {
      parse(vm, new Tokenizer('1 case 1 of 2 ;'));
      expect(getStackData(vm).some((value: unknown) => Number.isNaN(value as number))).toBe(true);
      expect(() => ensureNoOpenConditionals(vm)).toThrow('Unclosed case');
    } catch (error) {
      expect((error as Error).message).toContain('Unclosed case');
    }
  });
});
