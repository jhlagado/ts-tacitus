/**
 * Opcode encoding/decoding utilities for the Tacit VM
 * 
 * Encoding Scheme:
 * - 0xxxxxxx: 7-bit built-in opcode (0-127)
 * - 1xxxxxxx yyyyyyyy: 15-bit function table index (little-endian)
 *   - x bits are LSB of index
 *   - y bits are MSB of index
 *   - Full index = (y << 7) | x
 */

/**
 * Maximum number of built-in operations (7 bits)
 */
export const MAX_BUILTINS = 128;

/**
 * Encodes a built-in opcode (0-127)
 * @param opcode The opcode to encode (0-127)
 * @returns The encoded byte
 */
export function encodeBuiltin(opcode: number): number {
  if (opcode < 0 || opcode >= MAX_BUILTINS) {
    throw new Error(`Opcode ${opcode} out of range (0-${MAX_BUILTINS-1})`);
  }
  return opcode;
}

/**
 * Encodes a function table index (0-16383) into two bytes
 * First byte has high bit set, second byte has high bit clear
 * @param index The function table index (0-16383)
 * @returns Array of two bytes [low, high]
 */
export function encodeFunctionIndex(index: number): [number, number] {
  if (index < 0 || index >= 0x4000) { // 2^14 = 16384 possible values
    throw new Error(`Function index ${index} out of range (0-16383)`);
  }
  const low = 0x80 | (index & 0x7F);        // Set high bit, keep 7 LSBs
  const high = (index >>> 7) & 0x7F;         // Get 7 MSBs, clear high bit
  return [low, high];
}

/**
 * Decodes a function table index from two bytes
 * @param byte1 First byte (with high bit set)
 * @param byte2 Second byte (with high bit clear)
 * @returns The decoded function table index
 */
export function decodeFunctionIndex(byte1: number, byte2: number): number {
  if ((byte1 & 0x80) === 0) {
    throw new Error('First byte must have high bit set');
  }
  if ((byte2 & 0x80) !== 0) {
    throw new Error('Second byte must have high bit clear');
  }
  return ((byte2 & 0x7F) << 7) | (byte1 & 0x7F);
}

/**
 * Determines if a byte is a built-in opcode (high bit clear)
 * @param byte The byte to check
 * @returns True if the byte is a built-in opcode
 */
export function isBuiltinOpcode(byte: number): boolean {
  return (byte & 0x80) === 0;
}
