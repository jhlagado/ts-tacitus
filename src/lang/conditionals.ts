import { SyntaxError, Tag, fromTaggedValue } from '@src/core';
import { vm } from './runtime';
import { Op } from '../ops/opcodes';

export function ensureNoOpenConditionals(): void {
  const stack = vm.getStackData();
  for (let i = 0; i < stack.length; i++) {
    const value = stack[i];
    if (!isNaN(value)) {
      continue;
    }
    const { tag, value: opcode } = fromTaggedValue(value);
    if (tag === Tag.BUILTIN && opcode === Op.EndIf) {
      throw new SyntaxError('Unclosed IF', vm.getStackData());
    }
  }
}
