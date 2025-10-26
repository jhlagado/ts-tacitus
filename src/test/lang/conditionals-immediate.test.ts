import { SEG_CODE, Tag, fromTaggedValue } from '../../core';
import { STACK_BASE, CELL_SIZE } from '../../core/constants';
import { createBuiltinRef } from '../../core/code-ref';
import { vm } from '../../core/global-state';
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
    vm.push(0);
    vm.push(createBuiltinRef(Op.EndCase));

    expect(() => beginElseImmediate()).toThrow('ELSE without IF');
  });

  test('ELSE requires placeholder beneath closer', () => {
    vm.push(createBuiltinRef(Op.EndIf));

    expect(() => beginElseImmediate()).toThrow('ELSE without IF');
  });

  test('ELSE complains about missing branch placeholder', () => {
    vm.push(Number.NaN);
    vm.push(createBuiltinRef(Op.EndIf));

    expect(() => beginElseImmediate()).toThrow('ELSE missing branch placeholder');
  });

  test('ELSE complains about invalid branch placeholder', () => {
    vm.push(-1);
    vm.push(createBuiltinRef(Op.EndIf));

    expect(() => beginElseImmediate()).toThrow('ELSE invalid branch placeholder');
  });

  test('ELSE patches placeholder and installs exit branch', () => {
    beginIfImmediate();
    const falseBranchPos = vm.peekAt(1);

    vm.compiler.compileOpcode(Op.Nop);
    const cpBeforeElse = vm.compiler.CP;

    beginElseImmediate();

    const patchedOffset = vm.memory.read16(SEG_CODE, falseBranchPos);
    expect(patchedOffset).toBe(vm.compiler.CP - (falseBranchPos + 2));

    const exitPlaceholder = vm.peekAt(1);
    expect(exitPlaceholder).toBe(cpBeforeElse + 1);

    // Verify closer is EndIf on the stack top
    verifyTaggedValue(vm.peek(), Tag.BUILTIN, Op.EndIf);
  });

  test('ensureNoOpenConditionals detects unclosed IF', () => {
    beginIfImmediate();
    expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(2);
    // Top of stack should be EndIf closer
    verifyTaggedValue(vm.peek(), Tag.BUILTIN, Op.EndIf);
    // Also verify the element beneath top is a NUMBER (branch placeholder offset)
    const belowTop = fromTaggedValue(vm.peekAt(1));
    expect(belowTop.tag).toBe(Tag.NUMBER);
    expect(() => ensureNoOpenConditionals()).toThrow('Unclosed IF');
  });

  test('ensureNoOpenConditionals detects unclosed when', () => {
    vm.push(createBuiltinRef(Op.EndWhen));
    expect(() => ensureNoOpenConditionals()).toThrow('Unclosed `when`');
  });

  test('ensureNoOpenConditionals passes on clean stack', () => {
    expect(() => ensureNoOpenConditionals()).not.toThrow();
  });
});
