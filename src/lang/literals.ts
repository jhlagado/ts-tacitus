import { Op } from '../ops/opcodes';
import type { VM } from '../core/vm';
import { requireParserState } from './state';

export function emitNumber(value: number): void {
  const state = requireParserState();
  const vm = state.vm;
  vm.compiler.compileOpcode(Op.LiteralNumber);
  vm.compiler.compileFloat32(value);
}

export function emitString(value: string): void {
  const state = requireParserState();
  const vm = state.vm;
  vm.compiler.compileOpcode(Op.LiteralString);
  const address = vm.digest.intern(value);
  vm.compiler.compile16(address);
}

// Backtick symbol parsing removed. Apostrophe shorthand handled in parser.
