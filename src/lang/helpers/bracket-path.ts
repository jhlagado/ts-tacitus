import { SyntaxError, digestIntern, type VM } from '@src/core';
import { emitOpcode, emitFloat32, emitUint16, getStackData } from '../../core/vm';
import { Op } from '../../ops/opcodes';
import { tokenizerNext, TokenType, type Tokenizer } from '../tokenizer';

export function compilePathList(vm: VM, tokenizer: Tokenizer): void {
  emitOpcode(vm, Op.OpenList);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const tok = tokenizerNext(tokenizer);
    if (tok.type === TokenType.SPECIAL && tok.value === ']') {
      break;
    }
    if (tok.type === TokenType.NUMBER) {
      emitOpcode(vm, Op.LiteralNumber);
      emitFloat32(vm, tok.value as number);
      continue;
    }
    if (tok.type === TokenType.STRING) {
      emitOpcode(vm, Op.LiteralString);
      emitUint16(vm, digestIntern(vm.compile.digest, tok.value as string));
      continue;
    }
    throw new SyntaxError(
      'Only numeric indices or string keys are supported in bracket paths',
      getStackData(vm),
    );
  }
  emitOpcode(vm, Op.CloseList);
}
