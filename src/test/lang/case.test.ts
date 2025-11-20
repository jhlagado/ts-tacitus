import { describe, test, expect, beforeEach } from '@jest/globals';
import { createTokenizer } from '../../lang/tokenizer';
import { parse } from '../../lang/parser';
import { ensureNoOpenConditionals } from '../../lang/meta';
import { createVM, VM } from '../../core';
import { executeTacitCode } from '../utils/vm-test-utils';
import { getStackData } from '../../core/vm';
import {
  SEG_CODE,
  Tag,
  getTaggedInfo,
  Sentinel,
  memoryRead8,
  memoryRead16,
  memoryReadFloat32,
} from '../../core';
import { STACK_BASE, RSTACK_BASE } from '../../core/constants';
import { createCodeRef } from '../../core/code-ref';
import { peekAt, peek, rpush, rpop, push, pop, emitOpcode, emitFloat32 } from '../../core/vm';
import {
  beginCaseImmediateOp,
  clauseDoImmediateOp,
  defaultImmediateOp,
  nilImmediateOp,
} from '../../lang/meta/immediate';
import { Op } from '../../ops/opcodes';
import { evalOp } from '../../ops/core';
import { endCaseOp } from '../../ops/core/core-ops';

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
        42 do 111 ;
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
        1 do 111 ;
        DEFAULT do 222 ;
      ;
    `,
    );

    expect(stack).toEqual([222]);
  });

  test('supports multiple clauses with shared exit and default', () => {
    const program = `
      case
        -1 do 111 ;
        0 do 222 ;
        DEFAULT do 333 ;
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
        0 do
          1 case
            1 do 999 ;
            DEFAULT do 100 ;
          ;
        ;
        DEFAULT do 200 ;
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
        DEFAULT do 10 ;
        DEFAULT do 20 ;
      ;
    `,
    );

    expect(stack).toEqual([10]);
  });

  test('raises when do appears without a surrounding case', () => {
    expect(() => parse(vm, createTokenizer('1 do 2 ;'))).toThrow("'do' without open case");
  });

  test('detects unclosed case constructs during final validation', () => {
    try {
      parse(vm, createTokenizer('1 case 1 do 2 ;'));
      expect(getStackData(vm).some((value: unknown) => Number.isNaN(value as number))).toBe(true);
      expect(() => ensureNoOpenConditionals(vm)).toThrow('Unclosed case');
    } catch (error) {
      expect((error as Error).message).toContain('Unclosed case');
    }
  });
});

describe('case immediates', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('beginCaseImmediate pushes saved RSP and closer', () => {
    beginCaseImmediateOp(vm);

    expect(vm.sp - STACK_BASE).toBe(2);
    const closer = peek(vm);
    const closerInfo = getTaggedInfo(closer);
    // Builtins are now stored as Tag.CODE with value < 128
    expect(closerInfo.tag).toBe(Tag.CODE);
    expect(closerInfo.value).toBe(Op.EndCase);

    const snapshot = peekAt(vm, 1);
    expect(snapshot).toBe(vm.rsp - RSTACK_BASE);
  });

  test('clauseDoImmediate emits comparison sequence and records placeholder', () => {
    beginCaseImmediateOp(vm);

    emitOpcode(vm, Op.LiteralNumber);
    emitFloat32(vm, 42);

    clauseDoImmediateOp(vm);

    expect(vm.sp - STACK_BASE).toBe(4);
    const closerInfo = getTaggedInfo(peek(vm));
    // Builtins are now stored as Tag.CODE with value < 128
    expect(closerInfo.tag).toBe(Tag.CODE);
    expect(closerInfo.value).toBe(Op.EndOf);

    const skipPos = peekAt(vm, 1);
    expect(typeof skipPos).toBe('number');
    expect(memoryRead16(vm.memory, SEG_CODE, skipPos)).toBe(0);

    const byteBefore = memoryRead8(vm.memory, SEG_CODE, vm.compiler.CP - 1);
    expect(byteBefore).toBe(Op.Drop);
  });

  test('defaultImmediate compiles sentinel literal', () => {
    defaultImmediateOp(vm);

    const opcode = memoryRead8(vm.memory, SEG_CODE, 0);
    expect(opcode).toBe(Op.LiteralNumber);

    const encoded = memoryReadFloat32(vm.memory, SEG_CODE, 1);
    const decoded = getTaggedInfo(encoded);
    expect(decoded.tag).toBe(Tag.SENTINEL);
    expect(decoded.value).toBe(Sentinel.DEFAULT);
  });

  test('nilImmediate compiles NIL sentinel literal', () => {
    nilImmediateOp(vm);

    const opcode = memoryRead8(vm.memory, SEG_CODE, 0);
    expect(opcode).toBe(Op.LiteralNumber);
    const encoded = memoryReadFloat32(vm.memory, SEG_CODE, 1);
    const decoded = getTaggedInfo(encoded);
    expect(decoded.tag).toBe(Tag.SENTINEL);
    expect(decoded.value).toBe(Sentinel.NIL);
  });

  test('ensureNoOpenConditionals flags unclosed case', () => {
    // Guard against surprising shared-state interactions: reinit the VM and parser stub explicitly.
    beginCaseImmediateOp(vm);

    // Sanity check that the closer marker is actually on the stack before asserting behaviour.
    expect(vm.sp - STACK_BASE).toBeGreaterThanOrEqual(2);
    const { tag, value } = getTaggedInfo(peek(vm));
    // Builtins are now stored as Tag.CODE with value < 128
    expect(tag).toBe(Tag.CODE);
    expect(value).toBe(Op.EndCase);

    expect(() => ensureNoOpenConditionals(vm)).toThrow('Unclosed case');
  });

  test('do without case raises error', () => {
    expect(() => clauseDoImmediateOp(vm)).toThrow(
      "'do' without open case",
    );
  });

  test('endOfOp patches predicate skip and records exit branch', () => {
    beginCaseImmediateOp(vm);

    emitOpcode(vm, Op.LiteralNumber);
    emitFloat32(vm, 10);

    clauseDoImmediateOp(vm);

    const skipPos = peekAt(vm, 1);

    emitOpcode(vm, Op.Nop);

    evalOp(vm); // executes EndOf

    expect(vm.sp - STACK_BASE).toBe(2);

    const exitPos = rpop(vm);
    expect(exitPos).toBeGreaterThan(skipPos);
    rpush(vm, exitPos);

    const skipOffset = memoryRead16(vm.memory, SEG_CODE, skipPos);
    expect(skipOffset).toBe(exitPos - skipPos);

    const branchOperand = memoryRead16(vm.memory, SEG_CODE, exitPos);
    expect(branchOperand).toBe(0);
  });

  test('endOfOp guards against missing predicate placeholder', () => {
    beginCaseImmediateOp(vm);

    emitOpcode(vm, Op.LiteralNumber);
    emitFloat32(vm, 20);

    clauseDoImmediateOp(vm);
    const endOfRef = pop(vm);
    push(vm, Number.NaN);
    push(vm, endOfRef);

    expect(() => evalOp(vm)).toThrow('endof missing predicate placeholder');
  });

  test('endOfOp validates surrounding case metadata', () => {
    beginCaseImmediateOp(vm);
    pop(vm); // remove EndCase to simulate misuse

    push(vm, 42);
    push(vm, createCodeRef(Op.EndOf));

    expect(() => evalOp(vm)).toThrow('clause closer without do');
  });

  test('endCaseOp emits final drop and patches exits', () => {
    beginCaseImmediateOp(vm);

    emitOpcode(vm, Op.LiteralNumber);
    emitFloat32(vm, 1);

    clauseDoImmediateOp(vm);
    const skipPos = peekAt(vm, 1);
    expect(memoryRead8(vm.memory, SEG_CODE, skipPos + 2)).toBe(Op.Drop);

    emitOpcode(vm, Op.Nop);

    evalOp(vm); // EndOf

    const exitPos = rpop(vm);
    rpush(vm, exitPos);

    evalOp(vm); // EndCase

    expect(vm.sp - STACK_BASE).toBe(0);

    const finalDropPos = vm.compiler.CP - 1;
    expect(memoryRead8(vm.memory, SEG_CODE, finalDropPos)).toBe(Op.Drop);

    const patchedExit = memoryRead16(vm.memory, SEG_CODE, exitPos);
    const expectedExitOffset = vm.compiler.CP - (exitPos + 2);
    expect(patchedExit).toBe(expectedExitOffset);

    const patchedSkip = memoryRead16(vm.memory, SEG_CODE, skipPos);
    expect(patchedSkip).toBe(exitPos - skipPos);
  });

  test('endCaseOp handles empty case by emitting lone drop', () => {
    beginCaseImmediateOp(vm);

    evalOp(vm);

    expect(vm.sp - STACK_BASE).toBe(0);
    expect(memoryRead8(vm.memory, SEG_CODE, vm.compiler.CP - 1)).toBe(Op.Drop);
  });
});

describe('case end corruption branch', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('endCaseOp detects return stack mismatch', () => {
    // Push savedRSP greater than current RSP to trigger mismatch branch
    push(vm, 1);
    expect(() => endCaseOp(vm)).toThrow('case corrupted return stack');
  });
});
