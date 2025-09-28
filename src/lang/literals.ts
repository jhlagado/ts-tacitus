import { isWhitespace, isGroupingChar } from '@src/core';
import { Op } from '../ops/opcodes';
import { vm } from './runtime';
import type { ParserState } from './state';

export function emitNumber(value: number): void {
  vm.compiler.compileOpcode(Op.LiteralNumber);
  vm.compiler.compileFloat32(value);
}

export function emitString(value: string): void {
  vm.compiler.compileOpcode(Op.LiteralString);
  const address = vm.digest.intern(value);
  vm.compiler.compile16(address);
}

export function parseBacktickSymbol(state: ParserState): void {
  let sym = '';

  while (state.tokenizer.position < state.tokenizer.input.length) {
    const ch = state.tokenizer.input[state.tokenizer.position];
    if (isWhitespace(ch) || isGroupingChar(ch)) break;
    sym += ch;
    state.tokenizer.position++;
    state.tokenizer.column++;
  }

  const addr = vm.digest.add(sym);
  vm.compiler.compileOpcode(Op.LiteralString);
  vm.compiler.compile16(addr);
}
