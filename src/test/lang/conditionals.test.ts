import { describe, test, expect, beforeEach } from '@jest/globals';
import { SEG_CODE, Tag, fromTaggedValue } from '../../core';
import { STACK_BASE, CELL_SIZE } from '../../core/constants';
import { createBuiltinRef } from '../../core/code-ref';
import { createVM, type VM } from '../../core/vm';
import { peekAt, push, peek } from '../../core/vm';
import { beginIfImmediate, beginElseImmediate, ensureNoOpenConditionals } from '../../lang/meta';
import { Tokenizer } from '../../lang/tokenizer';
import { Op } from '../../ops/opcodes';
import { verifyTaggedValue } from '../utils/vm-test-utils';
import { parse } from '../../lang/parser';
import { executeTacitCode } from '../utils/vm-test-utils';
import { getStackData } from '../../core/vm';

describe('conditional immediates', () => {
  let vm: VM;
  const tokenizer = new Tokenizer('');
  const currentDefinition = { current: null };

  beforeEach(() => {
    vm = createVM();
  });

  test('ELSE without open IF throws', () => {
    expect(() => beginElseImmediate(vm, tokenizer, currentDefinition)).toThrow('ELSE without IF');
  });

  test('ELSE rejects mismatched closer', () => {
    push(vm, 0);
    push(vm, createBuiltinRef(Op.EndCase));

    expect(() => beginElseImmediate(vm, tokenizer, currentDefinition)).toThrow('ELSE without IF');
  });

  test('ELSE requires placeholder beneath closer', () => {
    push(vm, createBuiltinRef(Op.EndIf));

    expect(() => beginElseImmediate(vm, tokenizer, currentDefinition)).toThrow('ELSE without IF');
  });

  test('ELSE complains about missing branch placeholder', () => {
    push(vm, Number.NaN);
    push(vm, createBuiltinRef(Op.EndIf));

    expect(() => beginElseImmediate(vm, tokenizer, currentDefinition)).toThrow(
      'ELSE missing branch placeholder',
    );
  });

  test('ELSE complains about invalid branch placeholder', () => {
    push(vm, -1);
    push(vm, createBuiltinRef(Op.EndIf));

    expect(() => beginElseImmediate(vm, tokenizer, currentDefinition)).toThrow(
      'ELSE invalid branch placeholder',
    );
  });

  test('ELSE patches placeholder and installs exit branch', () => {
    beginIfImmediate(vm, tokenizer, currentDefinition);
    const falseBranchPos = peekAt(vm, 1);

    vm.compiler.compileOpcode(Op.Nop);
    const cpBeforeElse = vm.compiler.CP;

    beginElseImmediate(vm, tokenizer, currentDefinition);

    const patchedOffset = vm.memory.read16(SEG_CODE, falseBranchPos);
    expect(patchedOffset).toBe(vm.compiler.CP - (falseBranchPos + 2));

    const exitPlaceholder = peekAt(vm, 1);
    expect(exitPlaceholder).toBe(cpBeforeElse + 1);

    // Verify closer is EndIf on the stack top
    verifyTaggedValue(peek(vm), Tag.BUILTIN, Op.EndIf);
  });

  test('ensureNoOpenConditionals detects unclosed IF', () => {
    beginIfImmediate(vm, tokenizer, currentDefinition);
    expect(vm.sp - STACK_BASE).toBe(2);
    // Top of stack should be EndIf closer
    verifyTaggedValue(peek(vm), Tag.BUILTIN, Op.EndIf);
    // Also verify the element beneath top is a NUMBER (branch placeholder offset)
    const belowTop = fromTaggedValue(peekAt(vm, 1));
    expect(belowTop.tag).toBe(Tag.NUMBER);
    expect(() => ensureNoOpenConditionals(vm)).toThrow('Unclosed IF');
  });

  test('ensureNoOpenConditionals detects unclosed match', () => {
    push(vm, createBuiltinRef(Op.EndMatch));
    expect(() => ensureNoOpenConditionals(vm)).toThrow('Unclosed `match`');
  });

  test('ensureNoOpenConditionals passes on clean stack', () => {
    expect(() => ensureNoOpenConditionals(vm)).not.toThrow();
  });
});

describe('match/with control flow', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('executes first matching clause and skips default', () => {
    const stack = executeTacitCode(
      vm,
      `
      10 match
        dup 9 gt with drop 111 ;
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
      2 match
        dup 9 gt with drop 111 ;
        drop 222
      ;
    `,
    );

    expect(stack).toEqual([222]);
  });

  test('supports multiple clauses with shared exit', () => {
    const program = `
      match
        dup 9 gt with drop 111 ;
        dup 3 lt with drop 222 ;
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

  test('allows nested match blocks inside the default area', () => {
    const program = `
      match
        dup 0 eq with drop 100 ;
        match dup 1 eq with drop 200 ; drop 300 ;
      ;
    `;

    const nestedMatch = executeTacitCode(vm, `1 ${program}`);
    expect(nestedMatch).toEqual([200]);

    const nestedDefault = executeTacitCode(vm, `2 ${program}`);
    expect(nestedDefault).toEqual([300]);
  });

  test('raises when with appears without a surrounding match', () => {
    expect(() => parse(vm, new Tokenizer('with ;'))).toThrow('with without match');
  });

  test('raises when match is not closed by final semicolon', () => {
    try {
      parse(vm, new Tokenizer('match dup 0 eq with drop 1 ;'));
      // If parse did not throw, the construct must still be marked open.
      expect(getStackData(vm).some((value: number) => Number.isNaN(value))).toBe(true);
      expect(() => ensureNoOpenConditionals(vm)).toThrow('Unclosed `match`');
    } catch (err) {
      expect((err as Error).message).toContain('Unclosed `match`');
    }
  });
});
