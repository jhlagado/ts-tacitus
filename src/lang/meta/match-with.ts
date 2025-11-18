import { SyntaxError, Tag, getTaggedInfo } from '@src/core';
import { createBuiltinRef } from '../../core/code-ref';
import { Op } from '../../ops/opcodes';
import {
  type VM,
  rdepth,
  depth,
  getStackData,
  peek,
  push,
  emitOpcode,
  emitUint16,
  getCompilePointer,
} from '../../core/vm';

const ENDMATCH_CODE_REF = createBuiltinRef(Op.EndMatch);
const ENDWITH_CODE_REF = createBuiltinRef(Op.EndWith);

export function beginMatchImmediateOp(vm: VM): void {
  // Push saved return stack snapshot as relative cells
  push(vm, rdepth(vm));
  push(vm, ENDMATCH_CODE_REF);
}

export function beginWithImmediateOp(vm: VM): void {
  if (depth(vm) === 0) {
    throw new SyntaxError('with without match', getStackData(vm));
  }

  const top = peek(vm);
  const { tag, value } = getTaggedInfo(top);
  // Check Tag.CODE < 128 (represents builtin opcode)
  if (tag !== Tag.CODE || value >= 128 || value !== Op.EndMatch) {
    throw new SyntaxError('with without match', getStackData(vm));
  }

  emitOpcode(vm, Op.IfFalseBranch);
  const skipPos = getCompilePointer(vm);
  emitUint16(vm, 0);

  push(vm, skipPos);
  push(vm, ENDWITH_CODE_REF);
}
