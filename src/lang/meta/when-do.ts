import { SyntaxError, Tag, fromTaggedValue } from '@src/core';
import { createBuiltinRef } from '../../core/code-ref';
import { Op } from '../../ops/opcodes';
import { vm } from '../runtime';
import { requireParserState } from '../state';

const ENDWHEN_CODE_REF = createBuiltinRef(Op.EndWhen);
const ENDDO_CODE_REF = createBuiltinRef(Op.EndDo);

export function beginWhenImmediate(): void {
  requireParserState();

  vm.push(vm.RSP);
  vm.push(ENDWHEN_CODE_REF);
}

export function beginDoImmediate(): void {
  requireParserState();

  vm.ensureStackSize(1, 'do');
  const top = vm.peek();
  const { tag, value } = fromTaggedValue(top);
  if (tag !== Tag.BUILTIN || value !== Op.EndWhen) {
    throw new SyntaxError('do without when', vm.getStackData());
  }

  vm.compiler.compileOpcode(Op.IfFalseBranch);
  const skipPos = vm.compiler.CP;
  vm.compiler.compile16(0);

  vm.push(skipPos);
  vm.push(ENDDO_CODE_REF);
}
