/**
 * @file src/core/code-ref.ts
 * Code reference utilities for unified @symbol system.
 */

import { Tag, Tagged } from './tagged';
import {
  CODE_ALIGN_BYTES,
  CODE_ALIGN_SHIFT,
  CODE_MAX_BYTE_ADDRESS,
  CODE_MAX_PAYLOAD,
  MIN_USER_OPCODE,
} from './constants';

/**
 * Encodes a bytecode address into X1516 format, applying configured alignment.
 * X1516 format: 15-bit address encoded over a 16-bit carrier where bit 7 is always 1.
 *
 * @param bytecodeAddr The bytecode address (byte-aligned, scaled by CODE_ALIGN_BYTES)
 * @returns The X1516 encoded value (0x0080-0xFFFF)
 * @throws {Error} If address is out of range
 */
export function encodeX1516(bytecodeAddr: number): number {
  if (CODE_ALIGN_BYTES <= 0 || (CODE_ALIGN_BYTES & (CODE_ALIGN_BYTES - 1)) !== 0) {
    throw new Error(`CODE_ALIGN_BYTES must be power-of-two, got ${CODE_ALIGN_BYTES}`);
  }
  if (bytecodeAddr < 0 || bytecodeAddr > CODE_MAX_BYTE_ADDRESS) {
    throw new Error(
      `Invalid address: ${bytecodeAddr}. Must be in range 0-${CODE_MAX_BYTE_ADDRESS} (aligned to ${CODE_ALIGN_BYTES} bytes)`,
    );
  }
  if ((bytecodeAddr & (CODE_ALIGN_BYTES - 1)) !== 0) {
    throw new Error(
      `Invalid alignment for address ${bytecodeAddr}: must be aligned to ${CODE_ALIGN_BYTES} bytes`,
    );
  }
  const payload = bytecodeAddr >> CODE_ALIGN_SHIFT;
  if (payload > CODE_MAX_PAYLOAD) {
    throw new Error(
      `Invalid address: ${bytecodeAddr}. Payload ${payload} exceeds CODE_MAX_PAYLOAD ${CODE_MAX_PAYLOAD}`,
    );
  }
  const low = 0x80 | (payload & 0x7f);
  const high = (payload >> 7) & 0xff;
  return (high << 8) | low;
}

/**
 * Decodes an X1516 encoded value back to the original *byte* address, applying configured alignment.
 *
 * @param encoded The X1516 encoded value (0x0080-0xFFFF)
 * @returns The original bytecode address (0..CODE_MAX_BYTE_ADDRESS)
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
  const payload = (high << 7) | (low & 0x7f);
  return payload << CODE_ALIGN_SHIFT;
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
  if (bytecodeAddr < 0 || bytecodeAddr > CODE_MAX_BYTE_ADDRESS) {
    throw new Error(
      `Invalid bytecode address: ${bytecodeAddr}. Must be in range 0-${CODE_MAX_BYTE_ADDRESS}.`,
    );
  }
  // If address < 128, store directly (builtin opcode; not X1516 encoded)
  if (bytecodeAddr < MIN_USER_OPCODE) {
    return Tagged(bytecodeAddr, Tag.CODE);
  }
  if ((bytecodeAddr & (CODE_ALIGN_BYTES - 1)) !== 0) {
    throw new Error(
      `Invalid alignment for bytecode address ${bytecodeAddr}: requires ${CODE_ALIGN_BYTES}-byte alignment`,
    );
  }
  // Otherwise, encode using X1516 format
  const encoded = encodeX1516(bytecodeAddr);
  return Tagged(encoded, Tag.CODE);
}
