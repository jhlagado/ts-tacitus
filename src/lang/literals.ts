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

// Backtick symbol parsing removed. Apostrophe shorthand handled in parser.
