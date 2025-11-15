import { NIL, Tag, Tagged } from '@src/core';
import type { VM } from '@src/core';
import { push } from '../../core/vm';
import { TokenType } from '../tokenizer';
import { getActiveTokenizer } from '../parser';

export function tokenNextOp(vm: VM): void {
  const tokenizer = getActiveTokenizer();
  if (!tokenizer) {
    throw new Error('token-next: no active tokenizer');
  }

  const token = tokenizer.nextToken();
  push(vm, Tagged(token.type, Tag.SENTINEL));

  switch (token.type) {
    case TokenType.NUMBER: {
      const value = typeof token.value === 'number' ? token.value : Number(token.value ?? 0);
      push(vm, value);
      return;
    }
    case TokenType.STRING:
    case TokenType.WORD:
    case TokenType.SPECIAL:
    case TokenType.SYMBOL:
    case TokenType.REF_SIGIL: {
      const str = token.value ?? '';
      const addr = vm.digest.intern(String(str));
      push(vm, Tagged(addr, Tag.STRING));
      return;
    }
    case TokenType.EOF: {
      push(vm, NIL);
      return;
    }
    default: {
      push(vm, NIL);
    }
  }
}
