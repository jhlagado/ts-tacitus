/**
 * @file src/lang/literals.ts
 * Literal emission utilities for compiler.
 */

import { Op } from '../ops/opcodes';
import { type VM, emitOpcode, emitFloat32, emitUint16 } from '../core/vm';

/**
 * Emits bytecode for a numeric literal.
 * @param vm - VM instance
 * @param value - Numeric value to emit
 */
export function emitNumber(vm: VM, value: number): void {
  emitOpcode(vm, Op.LiteralNumber);
  emitFloat32(vm, value);
}

/**
 * Emits bytecode for a string literal.
 * @param vm - VM instance
 * @param value - String value to emit
 */
export function emitString(vm: VM, value: string): void {
  emitOpcode(vm, Op.LiteralString);
  const address = vm.digest.intern(value);
  emitUint16(vm, address);
}
