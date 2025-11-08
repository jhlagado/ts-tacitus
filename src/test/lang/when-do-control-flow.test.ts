import { describe, test, expect, beforeEach } from '@jest/globals';
import { Tokenizer } from '../../lang/tokenizer';
import { parse } from '../../lang/parser';
import { ensureNoOpenConditionals } from '../../lang/meta';
import { createVM, VM } from '../../core';
import { executeTacitCode } from '../utils/vm-test-utils';
import { getStackData } from '../../core/vm';

describe('when/do control flow', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('executes first matching clause and skips default', () => {
    const stack = executeTacitCode(
      vm,
      `
      10 when
        dup 9 gt do drop 111 ;
        drop 222
      ;
    `,
    );

    expect(stack).toEqual([111]);
  });

  test('falls through to default when no predicates match', () => {
    const stack = executeTacitCode(
      vm,
      `
      2 when
        dup 9 gt do drop 111 ;
        drop 222
      ;
    `,
    );

    expect(stack).toEqual([222]);
  });

  test('supports multiple clauses with shared exit', () => {
    const program = `
      when
        dup 9 gt do drop 111 ;
        dup 3 lt do drop 222 ;
        drop 333
      ;
    `;

    const moreThanNine = executeTacitCode(vm, `12 ${program}`);
    expect(moreThanNine).toEqual([111]);

    const lessThanThree = executeTacitCode(vm, `2 ${program}`);
    expect(lessThanThree).toEqual([222]);

    const otherwise = executeTacitCode(vm, `5 ${program}`);
    expect(otherwise).toEqual([333]);
  });

  test('allows nested when blocks inside the default region', () => {
    const program = `
      when
        dup 0 eq do drop 100 ;
        when dup 1 eq do drop 200 ; drop 300 ;
      ;
    `;

    const nestedMatch = executeTacitCode(vm, `1 ${program}`);
    expect(nestedMatch).toEqual([200]);

    const nestedDefault = executeTacitCode(vm, `2 ${program}`);
    expect(nestedDefault).toEqual([300]);
  });

  test('raises when do appears without a surrounding when', () => {
    expect(() => parse(new Tokenizer('do ;'))).toThrow('do without when');
  });

  test('raises when when is not closed by final semicolon', () => {
    try {
      parse(new Tokenizer('when dup 0 eq do drop 1 ;'));
      // If parse did not throw, the construct must still be marked open.
      expect(getStackData(vm).some((value: number) => Number.isNaN(value))).toBe(true);
      expect(() => ensureNoOpenConditionals()).toThrow('Unclosed `when`');
    } catch (err) {
      expect((err as Error).message).toContain('Unclosed `when`');
    }
  });
});
