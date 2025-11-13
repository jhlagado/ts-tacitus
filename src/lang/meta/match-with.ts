import { SyntaxError, Tag, getTaggedInfo } from '@src/core';
import { createBuiltinRef } from '../../core/code-ref';
import { Op } from '../../ops/opcodes';
import { type VM, rdepth, depth, getStackData, peek, push } from '../../core/vm';
import { type Tokenizer } from '../tokenizer';
import { type ActiveDefinition } from '../state';

const ENDMATCH_CODE_REF = createBuiltinRef(Op.EndMatch);
const ENDWITH_CODE_REF = createBuiltinRef(Op.EndWith);

export function beginMatchImmediate(
  vm: VM,
  _tokenizer: Tokenizer,
  _currentDefinition: { current: ActiveDefinition | null },
): void {
  // Push saved return stack snapshot as relative cells
  push(vm, rdepth(vm));
  push(vm, ENDMATCH_CODE_REF);
}

export function beginWithImmediate(
  vm: VM,
  _tokenizer: Tokenizer,
  _currentDefinition: { current: ActiveDefinition | null },
): void {
  if (depth(vm) === 0) {
    throw new SyntaxError('with without match', getStackData(vm));
  }

  const top = peek(vm);
  const { tag, value } = getTaggedInfo(top);
  // Check Tag.CODE < 128 (represents builtin opcode)
  if (tag !== Tag.CODE || value >= 128 || value !== Op.EndMatch) {
    throw new SyntaxError('with without match', getStackData(vm));
  }

  vm.compiler.compileOpcode(Op.IfFalseBranch);
  const skipPos = vm.compiler.CP;
  vm.compiler.compile16(0);

  push(vm, skipPos);
  push(vm, ENDWITH_CODE_REF);
}
