import { Op } from '../ops/opcodes';
import type { VM } from '../core/vm';

export function emitNumber(vm: VM, value: number): void {
  vm.compiler.compileOpcode(Op.LiteralNumber);
  vm.compiler.compileFloat32(value);
}

export function emitString(vm: VM, value: string): void {
  vm.compiler.compileOpcode(Op.LiteralString);
  const address = vm.digest.intern(value);
  vm.compiler.compile16(address);
}

// Backtick symbol parsing removed. Apostrophe shorthand handled in parser.
