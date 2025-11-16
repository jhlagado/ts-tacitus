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
  let payload: number;

  switch (token.type) {
    case TokenType.NUMBER:
      payload = typeof token.value === 'number' ? token.value : Number(token.value ?? 0);
      break;
    case TokenType.STRING:
    case TokenType.WORD:
    case TokenType.SPECIAL:
    case TokenType.REF_SIGIL: {
      const str = String(token.value ?? '');
      const addr = vm.digest.intern(str);
      payload = Tagged(addr, Tag.STRING);
      break;
    }
    case TokenType.EOF:
      payload = NIL;
      break;
    default:
      payload = NIL;
  }

  push(vm, payload);
  push(vm, token.type);
}
