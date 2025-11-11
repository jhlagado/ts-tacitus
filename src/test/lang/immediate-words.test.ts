import { describe, test, expect, beforeEach } from '@jest/globals';
import { Tokenizer } from '../../lang/tokenizer';
import { parse } from '../../lang/parser';
import { createVM, VM } from '../../core';
import { Op } from '../../ops/opcodes';
import { executeTacitCode } from '../utils/vm-test-utils';
import { define, findBytecodeAddress } from '../../core/dictionary';
import { toTaggedValue, Tag } from '../../core';
import { push, getStackData } from '../../core/vm';

describe('Immediate words', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  // Custom immediate implementations removed; rely on opcode/code immediates only

  test('executes builtin opcode immediates immediately', () => {
    push(vm, 42);

    define(vm, 'immdup', toTaggedValue(Op.Dup, Tag.BUILTIN, 1));

    parse(vm, new Tokenizer('immdup'));

    const stack = getStackData(vm);
    expect(stack.length).toBe(2);
    expect(stack[0]).toBe(42);
    expect(stack[1]).toBe(42);
  });

  test('executes immediate colon definitions via code references', () => {
    parse(vm, new Tokenizer(': inc1 1 add ;'));

    const addr = findBytecodeAddress(vm, 'inc1');
    expect(addr).toBeDefined();

    define(vm, 'inc1!', toTaggedValue(addr!, Tag.CODE, 1));

    push(vm, 5);
    parse(vm, new Tokenizer('inc1!'));

    const stack = getStackData(vm);
    expect(stack.length).toBe(1);
    expect(stack[0]).toBe(6);
  });

  test('colon definition words execute immediately', () => {
    const stack = executeTacitCode(
      vm,
      `
      : double
        # ( n — n*2 )
        dup add
      ;
      2 double        # ( 2 — 4 )
    `,
    );
    expect(stack).toEqual([4]);
  });

  test('if immediate compiles single-branch conditionals', () => {
    const negateTrue = executeTacitCode(
      vm,
      `
      # If negative, negate it
      -5 dup 0 lt if neg ;    # ( -5 — 5 )
    `,
    );
    expect(negateTrue).toEqual([5]);

    const negateFalse = executeTacitCode(
      vm,
      `
      : maybe-negate
        # ( n — |n| if n < 0, else n )
        dup 0 lt if neg ;
      ;
      4 maybe-negate   # ( 4 — 4 ) since 4 >= 0
    `,
    );
    expect(negateFalse).toEqual([4]);
  });

  test('if/else immediate compiles dual-branch conditionals', () => {
    // const positive = executeTacitCode(vm,  ': sign 0 lt if -1 else 1 ; ; 3 sign');
    const positive = executeTacitCode(
      vm,
      `
      # Sign function: return -1 if negative, else 1
      3 0 lt if -1 else 1 ;    # ( 3 — 1 )
    `,
    );
    expect(positive).toEqual([1]);

    const negative = executeTacitCode(
      vm,
      `
      # Sign function: return -1 if negative, else 1
      -7 0 lt if -1 else 1 ;   # ( -7 — -1 )
    `,
    );
    expect(negative).toEqual([-1]);
  });

  test('else without if raises syntax error', () => {
    expect(() => parse(vm, new Tokenizer(': stray else ;'))).toThrow('ELSE without IF');
  });
});
