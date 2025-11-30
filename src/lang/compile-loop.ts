import { Tag, getTaggedInfo, UnexpectedTokenError, digestGet, digestIntern } from '@src/core';
import type { VM } from '@src/core';
import { ensureStackSize, pop, getStackData, emitOpcode, push, emitFloat32, emitUint16 } from '../core/vm';
import { Op } from '../ops/opcodes';
import {
  handleSpecial,
  emitWord,
  emitRefSigil,
  validateFinalState,
  tokenNext,
} from './parser';
import { TokenType } from './tokenizer';

export function runTacitCompileLoop(vm: VM): void {
  for (;;) {
    const { type, raw } = tokenNext(vm);

    switch (type) {
      case TokenType.EOF:
        finalizeCompile(vm);
        push(vm, 1);
        return;
      case TokenType.NUMBER:
        emitOpcode(vm, Op.LiteralNumber);
        emitFloat32(vm, raw);
        break;
      case TokenType.STRING: {
        const text = getStringFromToken(vm, raw, 'emit-string');
        emitOpcode(vm, Op.LiteralString);
        emitUint16(vm, digestIntern(vm.compile.digest, text));
        break;
      }
      case TokenType.SPECIAL: {
        const text = getStringFromToken(vm, raw, 'handle-special');
        const { tokenizer } = vm.compile;
        if (!tokenizer) {
          throw new Error('handle-special: no active tokenizer');
        }
        handleSpecial(vm, text, tokenizer);
        break;
      }
      case TokenType.WORD: {
        const text = getStringFromToken(vm, raw, 'emit-word');
        const { tokenizer } = vm.compile;
        if (!tokenizer) {
          throw new Error('emit-word: no active tokenizer');
        }
        emitWord(vm, text, tokenizer);
        break;
      }
      case TokenType.REF_SIGIL: {
        getStringFromToken(vm, raw, 'emit-ref-sigil');
        const { tokenizer } = vm.compile;
        if (!tokenizer) {
          throw new Error('emit-ref-sigil: no active tokenizer');
        }
        emitRefSigil(vm, tokenizer);
        break;
      }
      default:
        push(vm, raw);
        push(vm, type);
        unexpectedToken(vm);
    }
  }
}

function getStringFromToken(vm: VM, raw: number, context: string): string {
  const info = getTaggedInfo(raw);
  if (info.tag !== Tag.STRING) {
    throw new Error(`${context}: expected STRING`);
  }
  return digestGet(vm.compile.digest, info.value);
}

export function finalizeCompile(vm: VM): void {
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
      return digestGet(vm.compile.digest, info.value);
    case Tag.SENTINEL:
      return `sentinel(${info.value})`;
    default:
      return String(info.value);
  }
}

export function unexpectedToken(vm: VM): void {
  ensureStackSize(vm, 2, 'unexpected-token');
  const tokenType = Math.trunc(pop(vm));
  const rawValue = pop(vm);
  const typeName = TOKEN_TYPE_NAMES[tokenType] ?? `type-${tokenType}`;
  const tokenLexeme = formatTokenValue(vm, rawValue);
  throw new UnexpectedTokenError(`${typeName} ${tokenLexeme}`, getStackData(vm));
}
