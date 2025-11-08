import { SEG_CODE, Tag, fromTaggedValue, Sentinel } from '../../core';
import { STACK_BASE, RSTACK_BASE, CELL_SIZE } from '../../core/constants';
import { createBuiltinRef } from '../../core/code-ref';
import { vm } from '../utils/vm-test-utils';
import { peekAt, peek, rpush, rpop, push, pop } from '../../core/vm';
import {
  beginCaseImmediate,
  clauseOfImmediate,
  defaultImmediate,
  nilImmediate,
} from '../../lang/meta/case';
import { ensureNoOpenConditionals } from '../../lang/meta';
import { setParserState } from '../../lang/state';
import { Tokenizer } from '../../lang/tokenizer';
import { Op } from '../../ops/opcodes';
import { evalOp } from '../../ops/core';
import { resetVM } from '../utils/vm-test-utils';

function setDummyParserState() {
  setParserState({ tokenizer: new Tokenizer(''), currentDefinition: null });
}

describe('case immediates', () => {
  beforeEach(() => {
    resetVM();
    setDummyParserState();
  });

  afterEach(() => {
    setParserState(null);
  });

  test('beginCaseImmediate pushes saved RSP and closer', () => {
    beginCaseImmediate(vm);

    expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(2);
    const closer = peek(vm);
    const closerInfo = fromTaggedValue(closer);
    expect(closerInfo.tag).toBe(Tag.BUILTIN);
    expect(closerInfo.value).toBe(Op.EndCase);

    const snapshot = peekAt(vm, 1);
    expect(snapshot).toBe(vm.rsp - RSTACK_BASE / CELL_SIZE);
  });

  test('clauseOfImmediate emits comparison sequence and records placeholder', () => {
    beginCaseImmediate(vm);

    vm.compiler.compileOpcode(Op.LiteralNumber);
    vm.compiler.compileFloat32(42);

    clauseOfImmediate(vm);

    expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(4);
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
    defaultImmediate(vm);

    const opcode = vm.memory.read8(SEG_CODE, 0);
    expect(opcode).toBe(Op.LiteralNumber);

    const encoded = vm.memory.readFloat32(SEG_CODE, 1);
    const decoded = fromTaggedValue(encoded);
    expect(decoded.tag).toBe(Tag.SENTINEL);
    expect(decoded.value).toBe(Sentinel.DEFAULT);
  });

  test('nilImmediate compiles NIL sentinel literal', () => {
    nilImmediate(vm);

    const opcode = vm.memory.read8(SEG_CODE, 0);
    expect(opcode).toBe(Op.LiteralNumber);
    const encoded = vm.memory.readFloat32(SEG_CODE, 1);
    const decoded = fromTaggedValue(encoded);
    expect(decoded.tag).toBe(Tag.SENTINEL);
    expect(decoded.value).toBe(Sentinel.NIL);
  });

  test('ensureNoOpenConditionals flags unclosed case', () => {
    // Guard against surprising shared-state interactions: reinit the VM and parser stub explicitly.
    resetVM();
    setDummyParserState();

    beginCaseImmediate(vm);

    // Sanity check that the closer marker is actually on the stack before asserting behaviour.
    expect(vm.sp - STACK_BASE / CELL_SIZE).toBeGreaterThanOrEqual(2);
    const { tag, value } = fromTaggedValue(peek(vm));
    expect(tag).toBe(Tag.BUILTIN);
    expect(value).toBe(Op.EndCase);

    expect(() => ensureNoOpenConditionals(vm)).toThrow('Unclosed case');
  });

  test('of without case raises error', () => {
    expect(() => clauseOfImmediate(vm)).toThrow("'of' without open case");
  });

  test('endOfOp patches predicate skip and records exit branch', () => {
    beginCaseImmediate(vm);

    vm.compiler.compileOpcode(Op.LiteralNumber);
    vm.compiler.compileFloat32(10);

    clauseOfImmediate(vm);

    const skipPos = peekAt(vm, 1);

    vm.compiler.compileOpcode(Op.Nop);

    evalOp(vm); // executes EndOf

    expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(2);

    const exitPos = rpop(vm);
    expect(exitPos).toBeGreaterThan(skipPos);
    rpush(vm, exitPos);

    const skipOffset = vm.memory.read16(SEG_CODE, skipPos);
    expect(skipOffset).toBe(exitPos - skipPos);

    const branchOperand = vm.memory.read16(SEG_CODE, exitPos);
    expect(branchOperand).toBe(0);
  });

  test('endOfOp guards against missing predicate placeholder', () => {
    beginCaseImmediate(vm);

    vm.compiler.compileOpcode(Op.LiteralNumber);
    vm.compiler.compileFloat32(20);

    clauseOfImmediate(vm);
    const endOfRef = pop(vm);
    push(vm, Number.NaN);
    push(vm, endOfRef);

    expect(() => evalOp(vm)).toThrow('endof missing predicate placeholder');
  });

  test('endOfOp validates surrounding case metadata', () => {
    beginCaseImmediate(vm);
    pop(vm); // remove EndCase to simulate misuse

    push(vm, 42);
    push(vm, createBuiltinRef(Op.EndOf));

    expect(() => evalOp(vm)).toThrow('clause closer without of');
  });

  test('endCaseOp emits final drop and patches exits', () => {
    beginCaseImmediate(vm);

    vm.compiler.compileOpcode(Op.LiteralNumber);
    vm.compiler.compileFloat32(1);

    clauseOfImmediate(vm);
    const skipPos = peekAt(vm, 1);
    expect(vm.memory.read8(SEG_CODE, skipPos + 2)).toBe(Op.Drop);

    vm.compiler.compileOpcode(Op.Nop);

    evalOp(vm); // EndOf

    const exitPos = rpop(vm);
    rpush(vm, exitPos);

    evalOp(vm); // EndCase

    expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(0);

    const finalDropPos = vm.compiler.CP - 1;
    expect(vm.memory.read8(SEG_CODE, finalDropPos)).toBe(Op.Drop);

    const patchedExit = vm.memory.read16(SEG_CODE, exitPos);
    const expectedExitOffset = vm.compiler.CP - (exitPos + 2);
    expect(patchedExit).toBe(expectedExitOffset);

    const patchedSkip = vm.memory.read16(SEG_CODE, skipPos);
    expect(patchedSkip).toBe(exitPos - skipPos);
  });

  test('endCaseOp handles empty case by emitting lone drop', () => {
    beginCaseImmediate(vm);

    evalOp(vm);

    expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(0);
    expect(vm.memory.read8(SEG_CODE, vm.compiler.CP - 1)).toBe(Op.Drop);
  });
});
