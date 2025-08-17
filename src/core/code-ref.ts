/**
 * @file src/core/code-ref.ts
 * Code reference utilities for unified @symbol system.
 */

import { Tag, toTaggedValue } from './tagged';
import { MAX_BUILTIN_OPCODE } from './constants';

/**
 * Creates a tagged reference to a built-in operation.
 * @param opcode The opcode of the built-in operation (0-127)
 * @returns A Tag.BUILTIN tagged value
 * @throws {Error} If opcode is out of range
 */
export function createBuiltinRef(opcode: number): number {
  if (opcode < 0 || opcode > MAX_BUILTIN_OPCODE) {
    throw new Error(`Invalid builtin opcode: ${opcode}. Must be in range 0-${MAX_BUILTIN_OPCODE}.`);
  }
  return toTaggedValue(opcode, Tag.BUILTIN);
}

/**
 * Creates a tagged reference to bytecode at a specific address.
 * @param bytecodeAddr The bytecode address in code segment
 * @returns A Tag.CODE tagged value
 * @throws {Error} If address is out of range
 */
export function createCodeRef(bytecodeAddr: number): number {
  if (bytecodeAddr < 0 || bytecodeAddr > 65535) {
    throw new Error(`Invalid bytecode address: ${bytecodeAddr}. Must be in range 0-65535.`);
  }
  return toTaggedValue(bytecodeAddr, Tag.CODE);
}

