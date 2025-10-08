import { Tokenizer } from '../../lang/tokenizer';
import { parse } from '../../lang/parser';
import { ensureNoOpenConditionals } from '../../lang/meta';
import { vm } from '../../core/global-state';
import { executeTacitCode, resetVM } from '../utils/vm-test-utils';

describe('case control flow', () => {
  beforeEach(() => {
    resetVM();
  });

  test('executes matching clause and consumes the discriminant', () => {
    const stack = executeTacitCode(`
      42 case
        42 of 111 ;
      ;
    `);

    expect(stack).toEqual([111]);
  });

  test('falls back to default when no predicates match', () => {
    const stack = executeTacitCode(`
      3 case
        1 of 111 ;
        DEFAULT of 222 ;
      ;
    `);

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

    const negative = executeTacitCode(`-1 ${program}`);
    expect(negative).toEqual([111]);

    const zero = executeTacitCode(`0 ${program}`);
    expect(zero).toEqual([222]);

    const other = executeTacitCode(`5 ${program}`);
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

    const nestedMatch = executeTacitCode(`0 ${program}`);
    expect(nestedMatch).toEqual([999]);

    const nestedDefault = executeTacitCode(`5 ${program}`);
    expect(nestedDefault).toEqual([200]);
  });

  test('first DEFAULT wins when multiple defaults are present', () => {
    const stack = executeTacitCode(`
      7 case
        DEFAULT of 10 ;
        DEFAULT of 20 ;
      ;
    `);

    expect(stack).toEqual([10]);
  });

  test('raises when of appears without a surrounding case', () => {
    expect(() => parse(new Tokenizer('1 of 2 ;'))).toThrow("'of' without open case");
  });

  test('detects unclosed case constructs during final validation', () => {
    try {
      parse(new Tokenizer('1 case 1 of 2 ;'));
      expect(vm.getStackData().some(value => Number.isNaN(value))).toBe(true);
      expect(() => ensureNoOpenConditionals()).toThrow('Unclosed case');
    } catch (error) {
      expect((error as Error).message).toContain('Unclosed case');
    }
  });
});
