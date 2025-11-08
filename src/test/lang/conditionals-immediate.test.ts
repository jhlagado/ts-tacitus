import { SEG_CODE, Tag, fromTaggedValue } from '../../core';
import { STACK_BASE, CELL_SIZE } from '../../core/constants';
import { createBuiltinRef } from '../../core/code-ref';
import { createVM, type VM } from '../../core/vm';
import { peekAt, push, peek } from '../../core/vm';
import { beginIfImmediate, beginElseImmediate, ensureNoOpenConditionals } from '../../lang/meta';
import { Tokenizer } from '../../lang/tokenizer';
import { Op } from '../../ops/opcodes';
import { verifyTaggedValue } from '../utils/vm-test-utils';

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

    expect(() => beginElseImmediate(vm, tokenizer, currentDefinition)).toThrow('ELSE missing branch placeholder');
  });

  test('ELSE complains about invalid branch placeholder', () => {
    push(vm, -1);
    push(vm, createBuiltinRef(Op.EndIf));

    expect(() => beginElseImmediate(vm, tokenizer, currentDefinition)).toThrow('ELSE invalid branch placeholder');
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
    expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(2);
    // Top of stack should be EndIf closer
    verifyTaggedValue(peek(vm), Tag.BUILTIN, Op.EndIf);
    // Also verify the element beneath top is a NUMBER (branch placeholder offset)
    const belowTop = fromTaggedValue(peekAt(vm, 1));
    expect(belowTop.tag).toBe(Tag.NUMBER);
    expect(() => ensureNoOpenConditionals(vm)).toThrow('Unclosed IF');
  });

  test('ensureNoOpenConditionals detects unclosed when', () => {
    push(vm, createBuiltinRef(Op.EndWhen));
    expect(() => ensureNoOpenConditionals(vm)).toThrow('Unclosed `when`');
  });

  test('ensureNoOpenConditionals passes on clean stack', () => {
    expect(() => ensureNoOpenConditionals(vm)).not.toThrow();
  });
});
