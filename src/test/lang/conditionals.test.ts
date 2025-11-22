import { describe, test, expect, beforeEach } from '@jest/globals';
import { SEG_CODE, Tag, getTaggedInfo, memoryRead16 } from '../../core';
import { STACK_BASE } from '../../core/constants';
import { createCodeRef } from '../../core/code-ref';
import { createVM, type VM, emitOpcode } from '../../core/vm';
import { peekAt, push, peek } from '../../core/vm';
import {
  beginIfImmediateOp,
  beginElseImmediateOp,
  ensureNoOpenConditionals,
} from '../../lang/meta';
import { Op } from '../../ops/opcodes';
import { verifyTaggedValue } from '../utils/vm-test-utils';
import { parse } from '../../lang/parser';
import { createTokenizer } from '../../lang/tokenizer';
import { executeTacitCode } from '../utils/vm-test-utils';
import { getStackData } from '../../core/vm';

describe('conditional immediates', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('ELSE without open IF throws', () => {
    expect(() => beginElseImmediateOp(vm)).toThrow('ELSE without IF');
  });

  test('ELSE rejects mismatched closer', () => {
    push(vm, 0);
    push(vm, createCodeRef(Op.EndCase));

    expect(() => beginElseImmediateOp(vm)).toThrow('ELSE without IF');
  });

  test('ELSE requires placeholder beneath closer', () => {
    push(vm, createCodeRef(Op.EndIf));

    expect(() => beginElseImmediateOp(vm)).toThrow('ELSE without IF');
  });

  test('ELSE complains about missing branch placeholder', () => {
    push(vm, Number.NaN);
    push(vm, createCodeRef(Op.EndIf));

    expect(() => beginElseImmediateOp(vm)).toThrow('ELSE missing branch placeholder');
  });

  test('ELSE complains about invalid branch placeholder', () => {
    push(vm, -1);
    push(vm, createCodeRef(Op.EndIf));

    expect(() => beginElseImmediateOp(vm)).toThrow('ELSE invalid branch placeholder');
  });

  test('ELSE patches placeholder and installs exit branch', () => {
    beginIfImmediateOp(vm);
    const falseBranchPos = peekAt(vm, 1);

    emitOpcode(vm, Op.Nop);
    const cpBeforeElse = vm.compile.CP;

    beginElseImmediateOp(vm);

    const patchedOffset = memoryRead16(vm.memory, SEG_CODE, falseBranchPos);
    expect(patchedOffset).toBe(vm.compile.CP - (falseBranchPos + 2));

    const exitPlaceholder = peekAt(vm, 1);
    expect(exitPlaceholder).toBe(cpBeforeElse + 1);

    // Verify closer is EndIf on the stack top (now stored as Tag.CODE)
    verifyTaggedValue(peek(vm), Tag.CODE, Op.EndIf);
  });

  test('ensureNoOpenConditionals detects unclosed IF', () => {
    beginIfImmediateOp(vm);
    expect(vm.sp - STACK_BASE).toBe(2);
    // Top of stack should be EndIf closer (now stored as Tag.CODE)
    verifyTaggedValue(peek(vm), Tag.CODE, Op.EndIf);
    // Also verify the element beneath top is a NUMBER (branch placeholder offset)
    const belowTop = getTaggedInfo(peekAt(vm, 1));
    expect(belowTop.tag).toBe(Tag.NUMBER);
    expect(() => ensureNoOpenConditionals(vm)).toThrow('Unclosed IF');
  });

  test('ensureNoOpenConditionals detects unclosed match', () => {
    push(vm, createCodeRef(Op.EndMatch));
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
    expect(() => parse(vm, createTokenizer('with ;'))).toThrow('with without match');
  });

  test('raises when match is not closed by final semicolon', () => {
    try {
      parse(vm, createTokenizer('match dup 0 eq with drop 1 ;'));
      // If parse did not throw, the construct must still be marked open.
      expect(getStackData(vm).some((value: number) => Number.isNaN(value))).toBe(true);
      expect(() => ensureNoOpenConditionals(vm)).toThrow('Unclosed `match`');
    } catch (err) {
      expect((err as Error).message).toContain('Unclosed `match`');
    }
  });
});
