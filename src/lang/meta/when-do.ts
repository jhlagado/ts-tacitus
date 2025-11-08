import { SyntaxError, Tag, fromTaggedValue } from '@src/core';
import { createBuiltinRef } from '../../core/code-ref';
import { Op } from '../../ops/opcodes';
import type { VM } from '../../core/vm';
import { requireParserState } from '../state';
import { rdepth, depth, getStackData, peek, push } from '../../core/vm';

const ENDWHEN_CODE_REF = createBuiltinRef(Op.EndWhen);
const ENDDO_CODE_REF = createBuiltinRef(Op.EndDo);

export function beginWhenImmediate(vm: VM): void {
  requireParserState();

  // Push saved return stack snapshot as relative cells
  push(vm, rdepth(vm));
  push(vm, ENDWHEN_CODE_REF);
}

export function beginDoImmediate(vm: VM): void {
  requireParserState();

  if (depth(vm) === 0) {
    throw new SyntaxError('do without when', getStackData(vm));
  }

  const top = peek(vm);
  const { tag, value } = fromTaggedValue(top);
  if (tag !== Tag.BUILTIN || value !== Op.EndWhen) {
    throw new SyntaxError('do without when', getStackData(vm));
  }

  vm.compiler.compileOpcode(Op.IfFalseBranch);
  const skipPos = vm.compiler.CP;
  vm.compiler.compile16(0);

  push(vm, skipPos);
  push(vm, ENDDO_CODE_REF);
}
