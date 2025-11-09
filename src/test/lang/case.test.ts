import { describe, test, expect, beforeEach } from '@jest/globals';
import { Tokenizer } from '../../lang/tokenizer';
import { parse } from '../../lang/parser';
import { ensureNoOpenConditionals } from '../../lang/meta';
import { createVM, VM } from '../../core';
import { executeTacitCode } from '../utils/vm-test-utils';
import { getStackData } from '../../core/vm';
import { SEG_CODE, Tag, fromTaggedValue, Sentinel } from '../../core';
import { STACK_BASE_CELLS, RSTACK_BASE_CELLS, CELL_SIZE } from '../../core/constants';
import { createBuiltinRef } from '../../core/code-ref';
import { peekAt, peek, rpush, rpop, push, pop } from '../../core/vm';
import {
  beginCaseImmediate,
  clauseOfImmediate,
  defaultImmediate,
  nilImmediate,
} from '../../lang/meta/case';
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

describe('case immediates', () => {
  let vm: VM;
  const tokenizer = new Tokenizer('');
  const currentDefinition = { current: null };

  beforeEach(() => {
    vm = createVM();
  });

  test('beginCaseImmediate pushes saved RSP and closer', () => {
    beginCaseImmediate(vm, tokenizer, currentDefinition);

    expect(vm.sp - STACK_BASE_CELLS).toBe(2);
    const closer = peek(vm);
    const closerInfo = fromTaggedValue(closer);
    expect(closerInfo.tag).toBe(Tag.BUILTIN);
    expect(closerInfo.value).toBe(Op.EndCase);

    const snapshot = peekAt(vm, 1);
    expect(snapshot).toBe(vm.rsp - RSTACK_BASE_CELLS);
  });

  test('clauseOfImmediate emits comparison sequence and records placeholder', () => {
    beginCaseImmediate(vm, tokenizer, currentDefinition);

    vm.compiler.compileOpcode(Op.LiteralNumber);
    vm.compiler.compileFloat32(42);

    clauseOfImmediate(vm, tokenizer, currentDefinition);

    expect(vm.sp - STACK_BASE_CELLS).toBe(4);
    const closerInfo = fromTaggedValue(peek(vm));
    expect(closerInfo.tag).toBe(Tag.BUILTIN);
    expect(closerInfo.value).toBe(Op.EndOf);

    const skipPos = peekAt(vm, 1);
    expect(typeof skipPos).toBe('number');
    expect(vm.memory.read16(SEG_CODE, skipPos)).toBe(0);

    const byteBefore = vm.memory.read8(SEG_CODE, vm.compiler.CP - 1);
    expect(byteBefore).toBe(Op.Drop);
  });

  test('defaultImmediate compiles sentinel literal', () => {
    defaultImmediate(vm, tokenizer, currentDefinition);

    const opcode = vm.memory.read8(SEG_CODE, 0);
    expect(opcode).toBe(Op.LiteralNumber);

    const encoded = vm.memory.readFloat32(SEG_CODE, 1);
    const decoded = fromTaggedValue(encoded);
    expect(decoded.tag).toBe(Tag.SENTINEL);
    expect(decoded.value).toBe(Sentinel.DEFAULT);
  });

  test('nilImmediate compiles NIL sentinel literal', () => {
    nilImmediate(vm, tokenizer, currentDefinition);

    const opcode = vm.memory.read8(SEG_CODE, 0);
    expect(opcode).toBe(Op.LiteralNumber);
    const encoded = vm.memory.readFloat32(SEG_CODE, 1);
    const decoded = fromTaggedValue(encoded);
    expect(decoded.tag).toBe(Tag.SENTINEL);
    expect(decoded.value).toBe(Sentinel.NIL);
  });

  test('ensureNoOpenConditionals flags unclosed case', () => {
    // Guard against surprising shared-state interactions: reinit the VM and parser stub explicitly.
    beginCaseImmediate(vm, tokenizer, currentDefinition);

    // Sanity check that the closer marker is actually on the stack before asserting behaviour.
    expect(vm.sp - STACK_BASE_CELLS).toBeGreaterThanOrEqual(2);
    const { tag, value } = fromTaggedValue(peek(vm));
    expect(tag).toBe(Tag.BUILTIN);
    expect(value).toBe(Op.EndCase);

    expect(() => ensureNoOpenConditionals(vm)).toThrow('Unclosed case');
  });

  test('of without case raises error', () => {
    expect(() => clauseOfImmediate(vm, tokenizer, currentDefinition)).toThrow("'of' without open case");
  });

  test('endOfOp patches predicate skip and records exit branch', () => {
    beginCaseImmediate(vm, tokenizer, currentDefinition);

    vm.compiler.compileOpcode(Op.LiteralNumber);
    vm.compiler.compileFloat32(10);

    clauseOfImmediate(vm, tokenizer, currentDefinition);

    const skipPos = peekAt(vm, 1);

    vm.compiler.compileOpcode(Op.Nop);

    evalOp(vm); // executes EndOf

    expect(vm.sp - STACK_BASE_CELLS).toBe(2);

    const exitPos = rpop(vm);
    expect(exitPos).toBeGreaterThan(skipPos);
    rpush(vm, exitPos);

    const skipOffset = vm.memory.read16(SEG_CODE, skipPos);
    expect(skipOffset).toBe(exitPos - skipPos);

    const branchOperand = vm.memory.read16(SEG_CODE, exitPos);
    expect(branchOperand).toBe(0);
  });

  test('endOfOp guards against missing predicate placeholder', () => {
    beginCaseImmediate(vm, tokenizer, currentDefinition);

    vm.compiler.compileOpcode(Op.LiteralNumber);
    vm.compiler.compileFloat32(20);

    clauseOfImmediate(vm, tokenizer, currentDefinition);
    const endOfRef = pop(vm);
    push(vm, Number.NaN);
    push(vm, endOfRef);

    expect(() => evalOp(vm)).toThrow('endof missing predicate placeholder');
  });

  test('endOfOp validates surrounding case metadata', () => {
    beginCaseImmediate(vm, tokenizer, currentDefinition);
    pop(vm); // remove EndCase to simulate misuse

    push(vm, 42);
    push(vm, createBuiltinRef(Op.EndOf));

    expect(() => evalOp(vm)).toThrow('clause closer without of');
  });

  test('endCaseOp emits final drop and patches exits', () => {
    beginCaseImmediate(vm, tokenizer, currentDefinition);

    vm.compiler.compileOpcode(Op.LiteralNumber);
    vm.compiler.compileFloat32(1);

    clauseOfImmediate(vm, tokenizer, currentDefinition);
    const skipPos = peekAt(vm, 1);
    expect(vm.memory.read8(SEG_CODE, skipPos + 2)).toBe(Op.Drop);

    vm.compiler.compileOpcode(Op.Nop);

    evalOp(vm); // EndOf

    const exitPos = rpop(vm);
    rpush(vm, exitPos);

    evalOp(vm); // EndCase

    expect(vm.sp - STACK_BASE_CELLS).toBe(0);

    const finalDropPos = vm.compiler.CP - 1;
    expect(vm.memory.read8(SEG_CODE, finalDropPos)).toBe(Op.Drop);

    const patchedExit = vm.memory.read16(SEG_CODE, exitPos);
    const expectedExitOffset = vm.compiler.CP - (exitPos + 2);
    expect(patchedExit).toBe(expectedExitOffset);

    const patchedSkip = vm.memory.read16(SEG_CODE, skipPos);
    expect(patchedSkip).toBe(exitPos - skipPos);
  });

  test('endCaseOp handles empty case by emitting lone drop', () => {
    beginCaseImmediate(vm, tokenizer, currentDefinition);

    evalOp(vm);

    expect(vm.sp - STACK_BASE_CELLS).toBe(0);
    expect(vm.memory.read8(SEG_CODE, vm.compiler.CP - 1)).toBe(Op.Drop);
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

