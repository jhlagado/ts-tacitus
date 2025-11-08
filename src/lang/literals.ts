/**
 * @file src/lang/literals.ts
 * Literal emission utilities for compiler.
 */

import { Op } from '../ops/opcodes';
import type { VM } from '../core/vm';

/**
 * Emits bytecode for a numeric literal.
 * @param vm - VM instance
 * @param value - Numeric value to emit
 */
export function emitNumber(vm: VM, value: number): void {
  vm.compiler.compileOpcode(Op.LiteralNumber);
  vm.compiler.compileFloat32(value);
}

/**
 * Emits bytecode for a string literal.
 * @param vm - VM instance
 * @param value - String value to emit
 */
export function emitString(vm: VM, value: string): void {
  vm.compiler.compileOpcode(Op.LiteralString);
  const address = vm.digest.intern(value);
  vm.compiler.compile16(address);
}
