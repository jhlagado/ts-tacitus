import { SyntaxError, isSpecialChar, type VM } from '@src/core';
import { getStackData } from '../../core/vm';
import { tokenizerNext, TokenType, type Tokenizer } from '../tokenizer';

export function ensureTokenizer(vm: VM, keyword: string): Tokenizer {
  const tokenizer = vm.compile.tokenizer;
  if (!tokenizer) {
    throw new SyntaxError(`${keyword} requires active tokenizer`, getStackData(vm));
  }
  return tokenizer;
}

export function readNameAfter(vm: VM, tokenizer: Tokenizer, keyword: string): string {
  const token = tokenizerNext(tokenizer);
  if (token.type !== TokenType.WORD) {
    throw new SyntaxError(`Expected variable name after ${keyword}`, getStackData(vm));
  }
  const name = token.value as string;
  if (
    name.length === 0 ||
    name === ':' ||
    name === ';' ||
    (name.length === 1 && isSpecialChar(name))
  ) {
    throw new SyntaxError(`Expected variable name after ${keyword}`, getStackData(vm));
  }
  return name;
}
