import { SEG_CODE, Tag, fromTaggedValue } from '../../core';
import { STACK_BASE, CELL_SIZE } from '../../core/constants';
import { createBuiltinRef } from '../../core/code-ref';
import { vm } from '../../lang/runtime';
import { peekAt, push, peek } from '../../core/vm';
import { beginIfImmediate, beginElseImmediate, ensureNoOpenConditionals } from '../../lang/meta';
import { setParserState } from '../../lang/state';
import { Tokenizer } from '../../lang/tokenizer';
import { Op } from '../../ops/opcodes';
import { resetVM, verifyTaggedValue } from '../utils/vm-test-utils';

function setDummyParserState(): void {
  setParserState({ tokenizer: new Tokenizer(''), currentDefinition: null });
}

describe('conditional immediates', () => {
  beforeEach(() => {
    resetVM();
    setDummyParserState();
  });

  afterEach(() => {
    setParserState(null);
  });

  test('ELSE without open IF throws', () => {
    expect(() => beginElseImmediate()).toThrow('ELSE without IF');
  });

  test('ELSE rejects mismatched closer', () => {
    push(vm, 0);
    push(vm, createBuiltinRef(Op.EndCase));

    expect(() => beginElseImmediate()).toThrow('ELSE without IF');
  });

  test('ELSE requires placeholder beneath closer', () => {
    push(vm, createBuiltinRef(Op.EndIf));

    expect(() => beginElseImmediate()).toThrow('ELSE without IF');
  });

  test('ELSE complains about missing branch placeholder', () => {
    push(vm, Number.NaN);
    push(vm, createBuiltinRef(Op.EndIf));

    expect(() => beginElseImmediate()).toThrow('ELSE missing branch placeholder');
  });

  test('ELSE complains about invalid branch placeholder', () => {
    push(vm, -1);
    push(vm, createBuiltinRef(Op.EndIf));

    expect(() => beginElseImmediate()).toThrow('ELSE invalid branch placeholder');
  });

  test('ELSE patches placeholder and installs exit branch', () => {
    beginIfImmediate();
    const falseBranchPos = peekAt(vm, 1);

    vm.compiler.compileOpcode(Op.Nop);
    const cpBeforeElse = vm.compiler.CP;

    beginElseImmediate();

    const patchedOffset = vm.memory.read16(SEG_CODE, falseBranchPos);
    expect(patchedOffset).toBe(vm.compiler.CP - (falseBranchPos + 2));

    const exitPlaceholder = peekAt(vm, 1);
    expect(exitPlaceholder).toBe(cpBeforeElse + 1);

    // Verify closer is EndIf on the stack top
    verifyTaggedValue(peek(vm), Tag.BUILTIN, Op.EndIf);
  });

  test('ensureNoOpenConditionals detects unclosed IF', () => {
    beginIfImmediate();
    expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(2);
    // Top of stack should be EndIf closer
    verifyTaggedValue(peek(vm), Tag.BUILTIN, Op.EndIf);
    // Also verify the element beneath top is a NUMBER (branch placeholder offset)
    const belowTop = fromTaggedValue(peekAt(vm, 1));
    expect(belowTop.tag).toBe(Tag.NUMBER);
    expect(() => ensureNoOpenConditionals()).toThrow('Unclosed IF');
  });

  test('ensureNoOpenConditionals detects unclosed when', () => {
    push(vm, createBuiltinRef(Op.EndWhen));
    expect(() => ensureNoOpenConditionals()).toThrow('Unclosed `when`');
  });

  test('ensureNoOpenConditionals passes on clean stack', () => {
    expect(() => ensureNoOpenConditionals()).not.toThrow();
  });
});
