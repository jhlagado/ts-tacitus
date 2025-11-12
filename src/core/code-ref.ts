/**
 * @file src/core/code-ref.ts
 * Code reference utilities for unified @symbol system.
 */

import { Tag, toTaggedValue } from './tagged';
import { MAX_BUILTIN_OPCODE } from './constants';

/**
 * Encodes a 15-bit address into X1516 format.
 * X1516 format: 15-bit address encoded over a 16-bit carrier where bit 7 is always 1.
 *
 * @param address The bytecode address (0-32767)
 * @returns The X1516 encoded value (0x0080-0xFFFF)
 * @throws {Error} If address is out of range
 */
export function encodeX1516(address: number): number {
  if (address < 0 || address > 32767) {
    throw new Error(`Invalid address: ${address}. Must be in range 0-32767.`);
  }
  const low = 0x80 | (address & 0x7f);
  const high = (address >> 7) & 0xff;
  return (high << 8) | low;
}

/**
 * Decodes an X1516 encoded value back to the original address.
 *
 * @param encoded The X1516 encoded value (0x0080-0xFFFF)
 * @returns The original bytecode address (0-32767)
 * @throws {Error} If encoded value is not valid X1516 format
 */
export function decodeX1516(encoded: number): number {
  if (encoded < 0x0080 || encoded > 0xffff) {
    throw new Error(`Invalid X1516 encoded value: ${encoded}. Must be in range 0x0080-0xFFFF.`);
  }
  const low = encoded & 0xff;
  const high = (encoded >> 8) & 0xff;
  if ((low & 0x80) === 0) {
    throw new Error(
      `Invalid X1516 format: bit 7 must be set in low byte. Got: 0x${encoded.toString(16)}`,
    );
  }
  return (high << 7) | (low & 0x7f);
}

/**
 * Creates a tagged reference to a built-in operation.
 * @deprecated This function now returns Tag.CODE instead of Tag.BUILTIN for unified dispatch.
 * Use createCodeRef() or toTaggedValue(opcode, Tag.CODE) for new code.
 * @param opcode The opcode of the built-in operation (0-127)
 * @returns A Tag.CODE tagged value (stored directly, not X1516 encoded)
 * @throws {Error} If opcode is out of range
 */
export function createBuiltinRef(opcode: number): number {
  if (opcode < 0 || opcode > MAX_BUILTIN_OPCODE) {
    throw new Error(`Invalid builtin opcode: ${opcode}. Must be in range 0-${MAX_BUILTIN_OPCODE}.`);
  }
  // Return Tag.CODE instead of Tag.BUILTIN for unified dispatch
  return toTaggedValue(opcode, Tag.CODE);
}

/**
 * Creates a tagged reference to bytecode at a specific address.
 * For addresses < 128, stores the value directly (invalid X1516 format, treated as builtin opcode).
 * For addresses >= 128, encodes using X1516 format before storing in Tag.CODE.
 * @param bytecodeAddr The bytecode address in code segment (0-32767)
 * @returns A Tag.CODE tagged value
 * @throws {Error} If address is out of range
 */
export function createCodeRef(bytecodeAddr: number): number {
  if (bytecodeAddr < 0 || bytecodeAddr > 32767) {
    throw new Error(`Invalid bytecode address: ${bytecodeAddr}. Must be in range 0-32767.`);
  }
  // If address < 128, store directly (invalid X1516, will be treated as builtin opcode)
  if (bytecodeAddr < 128) {
    return toTaggedValue(bytecodeAddr, Tag.CODE);
  }
  // Otherwise, encode using X1516 format
  const encoded = encodeX1516(bytecodeAddr);
  return toTaggedValue(encoded, Tag.CODE);
}
