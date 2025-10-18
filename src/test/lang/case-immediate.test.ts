import { SEG_CODE, Tag, fromTaggedValue, Sentinel } from '../../core';
import { createBuiltinRef } from '../../core/code-ref';
import { vm } from '../../core/global-state';
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
    beginCaseImmediate();

    expect(vm.SP).toBe(2);
    const closer = vm.peek();
    const closerInfo = fromTaggedValue(closer);
    expect(closerInfo.tag).toBe(Tag.BUILTIN);
    expect(closerInfo.value).toBe(Op.EndCase);

    const snapshot = vm.peekAt(1);
    expect(snapshot).toBe(vm.RSP);
  });

  test('clauseOfImmediate emits comparison sequence and records placeholder', () => {
    beginCaseImmediate();

    vm.compiler.compileOpcode(Op.LiteralNumber);
    vm.compiler.compileFloat32(42);

    clauseOfImmediate();

    expect(vm.SP).toBe(4);
    const closerInfo = fromTaggedValue(vm.peek());
    expect(closerInfo.tag).toBe(Tag.BUILTIN);
    expect(closerInfo.value).toBe(Op.EndOf);

    const skipPos = vm.peekAt(1);
    expect(typeof skipPos).toBe('number');
    expect(vm.memory.read16(SEG_CODE, skipPos)).toBe(0);

    const byteBefore = vm.memory.read8(SEG_CODE, vm.compiler.CP - 1);
    expect(byteBefore).toBe(Op.Drop);
  });

  test('defaultImmediate compiles sentinel literal', () => {
    defaultImmediate();

    const opcode = vm.memory.read8(SEG_CODE, 0);
    expect(opcode).toBe(Op.LiteralNumber);

    const encoded = vm.memory.readFloat32(SEG_CODE, 1);
    const decoded = fromTaggedValue(encoded);
    expect(decoded.tag).toBe(Tag.SENTINEL);
    expect(decoded.value).toBe(Sentinel.DEFAULT);
  });

  test('nilImmediate compiles NIL sentinel literal', () => {
    nilImmediate();

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

    beginCaseImmediate();

    // Sanity check that the closer marker is actually on the stack before asserting behaviour.
    expect(vm.SP).toBeGreaterThanOrEqual(2);
    const { tag, value } = fromTaggedValue(vm.peek());
    expect(tag).toBe(Tag.BUILTIN);
    expect(value).toBe(Op.EndCase);

    expect(() => ensureNoOpenConditionals()).toThrow('Unclosed case');
  });

  test('of without case raises error', () => {
    expect(() => clauseOfImmediate()).toThrow("'of' without open case");
  });

  test('endOfOp patches predicate skip and records exit branch', () => {
    beginCaseImmediate();

    vm.compiler.compileOpcode(Op.LiteralNumber);
    vm.compiler.compileFloat32(10);

    clauseOfImmediate();

    const skipPos = vm.peekAt(1);

    vm.compiler.compileOpcode(Op.Nop);

    evalOp(vm); // executes EndOf

    expect(vm.SP).toBe(2);

    const exitPos = vm.rpop();
    expect(exitPos).toBeGreaterThan(skipPos);
    vm.rpush(exitPos);

    const skipOffset = vm.memory.read16(SEG_CODE, skipPos);
    expect(skipOffset).toBe(exitPos - skipPos);

    const branchOperand = vm.memory.read16(SEG_CODE, exitPos);
    expect(branchOperand).toBe(0);
  });

  test('endOfOp guards against missing predicate placeholder', () => {
    beginCaseImmediate();

    vm.compiler.compileOpcode(Op.LiteralNumber);
    vm.compiler.compileFloat32(20);

    clauseOfImmediate();
    const endOfRef = vm.pop();
    vm.push(Number.NaN);
    vm.push(endOfRef);

    expect(() => evalOp(vm)).toThrow('endof missing predicate placeholder');
  });

  test('endOfOp validates surrounding case metadata', () => {
    beginCaseImmediate();
    vm.pop(); // remove EndCase to simulate misuse

    vm.push(42);
    vm.push(createBuiltinRef(Op.EndOf));

    expect(() => evalOp(vm)).toThrow('clause closer without of');
  });

  test('endCaseOp emits final drop and patches exits', () => {
    beginCaseImmediate();

    vm.compiler.compileOpcode(Op.LiteralNumber);
    vm.compiler.compileFloat32(1);

    clauseOfImmediate();
    const skipPos = vm.peekAt(1);
    expect(vm.memory.read8(SEG_CODE, skipPos + 2)).toBe(Op.Drop);

    vm.compiler.compileOpcode(Op.Nop);

    evalOp(vm); // EndOf

    const exitPos = vm.rpop();
    vm.rpush(exitPos);

    evalOp(vm); // EndCase

    expect(vm.SP).toBe(0);

    const finalDropPos = vm.compiler.CP - 1;
    expect(vm.memory.read8(SEG_CODE, finalDropPos)).toBe(Op.Drop);

    const patchedExit = vm.memory.read16(SEG_CODE, exitPos);
    const expectedExitOffset = vm.compiler.CP - (exitPos + 2);
    expect(patchedExit).toBe(expectedExitOffset);

    const patchedSkip = vm.memory.read16(SEG_CODE, skipPos);
    expect(patchedSkip).toBe(exitPos - skipPos);
  });

  test('endCaseOp handles empty case by emitting lone drop', () => {
    beginCaseImmediate();

    evalOp(vm);

    expect(vm.SP).toBe(0);
    expect(vm.memory.read8(SEG_CODE, vm.compiler.CP - 1)).toBe(Op.Drop);
  });
});
