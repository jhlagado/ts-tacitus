import { Tag, getTaggedInfo, UnexpectedTokenError } from '@src/core';
import type { VM } from '@src/core';
import { ensureStackSize, pop, getStackData, emitOpcode, push } from '../../core/vm';
import { Op } from '../../ops/opcodes';
import { emitNumber, emitString } from '../literals';
import {
  handleSpecial,
  emitWord,
  emitRefSigil,
  validateFinalState,
  getActiveTokenizer,
} from '../parser';
import { TokenType } from '../tokenizer';
import { tokenNextOp } from './token-bridge';
export function runTacitCompileLoopOp(vm: VM): void {
  for (;;) {
    tokenNextOp(vm);
    const tokenType = pop(vm);
    const payload = pop(vm);
    const { tag, value } = getTaggedInfo(tokenType);
    if (tag !== Tag.NUMBER) {
      throw new Error('runTacitCompileLoopOp: token type must be numeric');
    }

    switch (value) {
      case TokenType.EOF:
        finalizeCompileOp(vm);
        push(vm, 1);
        return;
      case TokenType.NUMBER:
        push(vm, payload);
        emitNumberOp(vm);
        break;
      case TokenType.STRING:
        push(vm, payload);
        emitStringOp(vm);
        break;
      case TokenType.SPECIAL:
        push(vm, payload);
        handleSpecialOp(vm);
        break;
      case TokenType.WORD:
        push(vm, payload);
        emitWordOp(vm);
        break;
      case TokenType.REF_SIGIL:
        push(vm, payload);
        emitRefSigilOp(vm);
        break;
      default:
        push(vm, payload);
        push(vm, tokenType);
        unexpectedTokenOp(vm);
    }
  }
}

function decodeString(vm: VM, raw: number, context: string): string {
  const info = getTaggedInfo(raw);
  if (info.tag !== Tag.STRING) {
    throw new Error(`${context}: expected STRING`);
  }
  return vm.digest.get(info.value);
}

export function emitNumberOp(vm: VM): void {
  ensureStackSize(vm, 1, 'emit-number');
  const value = pop(vm);
  emitNumber(vm, value);
}

export function emitStringOp(vm: VM): void {
  ensureStackSize(vm, 1, 'emit-string');
  const raw = pop(vm);
  const text = decodeString(vm, raw, 'emit-string');
  emitString(vm, text);
}

export function handleSpecialOp(vm: VM): void {
  ensureStackSize(vm, 1, 'handle-special');
  const raw = pop(vm);
  const text = decodeString(vm, raw, 'handle-special');
  const tokenizer = getActiveTokenizer();
  if (!tokenizer) {
    throw new Error('handle-special: no active tokenizer');
  }
  handleSpecial(vm, text, tokenizer);
}

export function emitWordOp(vm: VM): void {
  ensureStackSize(vm, 1, 'emit-word');
  const raw = pop(vm);
  const text = decodeString(vm, raw, 'emit-word');
  const tokenizer = getActiveTokenizer();
  if (!tokenizer) {
    throw new Error('emit-word: no active tokenizer');
  }
  emitWord(vm, text, tokenizer);
}

export function emitSymbolOp(): void {
  throw new Error('emit-symbol removed; use ref sigil helpers instead.');
}

export function emitRefSigilOp(vm: VM): void {
  ensureStackSize(vm, 1, 'emit-ref-sigil');
  const raw = pop(vm);
  const text = decodeString(vm, raw, 'emit-ref-sigil');
  const tokenizer = getActiveTokenizer();
  if (!tokenizer) {
    throw new Error('emit-ref-sigil: no active tokenizer');
  }
  emitRefSigil(vm, text, tokenizer);
}

export function finalizeCompileOp(vm: VM): void {
  validateFinalState(vm);
  emitOpcode(vm, Op.Abort);
}

const TOKEN_TYPE_NAMES: Record<number, string> = {
  0: 'NUMBER',
  1: 'WORD',
  2: 'STRING',
  3: 'SPECIAL',
  4: 'REF_SIGIL',
  5: 'EOF',
};

function formatTokenValue(vm: VM, raw: number): string {
  const info = getTaggedInfo(raw);
  switch (info.tag) {
    case Tag.STRING:
      return vm.digest.get(info.value);
    case Tag.SENTINEL:
      return `sentinel(${info.value})`;
    default:
      return String(info.value);
  }
}

export function unexpectedTokenOp(vm: VM): void {
  ensureStackSize(vm, 2, 'unexpected-token');
  const tokenType = Math.trunc(pop(vm));
  const rawValue = pop(vm);
  const typeName = TOKEN_TYPE_NAMES[tokenType] ?? `type-${tokenType}`;
  const tokenLexeme = formatTokenValue(vm, rawValue);
  throw new UnexpectedTokenError(`${typeName} ${tokenLexeme}`, getStackData(vm));
}
