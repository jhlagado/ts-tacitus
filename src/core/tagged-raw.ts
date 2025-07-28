/*
 * Raw bit manipulation functions for corruption-safe NaN-boxing operations.
 * These functions bypass JavaScript's IEEE 754 float normalization to preserve
 * tagged value integrity in the TACIT virtual machine.
 */

import { Tag } from './tagged';

/**
 * Constants used in the raw bit NaN-boxing scheme.
 */
const VALUE_BITS = 16;
const NAN_BIT = 1 << 22;
const TAG_MANTISSA_MASK = 0x7f << 16;
const VALUE_MASK = (1 << VALUE_BITS) - 1;
const EXPONENT_MASK = 0xff << 23;

/**
 * Encodes a value and its type tag into raw 32-bit unsigned integer bits
 * using NaN-boxing. This bypasses JavaScript's IEEE 754 float normalization
 * and preserves the exact bit pattern for tagged values.
 *
 * @param value The value to encode. For Tag.INTEGER, this should be a signed integer (-32768 to 32767); for
 *     other tags, it should be an unsigned integer (0 to 65535).
 * @param tag The tag representing the data type. This should be a value from Tag.
 * @returns A 32-bit unsigned integer representing the raw bits of the NaN-boxed tagged value.
 * @throws {Error} If the tag or value is invalid.
 */
export function toTaggedValueRaw(value: number, tag: Tag): number {
  if (tag < Tag.NUMBER || tag > Tag.LINK) {
    throw new Error(`Invalid tag: ${tag}`);
  }

  if (tag === Tag.NUMBER) {
    // For raw numbers, convert to bits using DataView to preserve IEEE 754 representation
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setFloat32(0, value, true);
    return view.getUint32(0, true);
  }

  let encodedValue: number;
  if (tag === Tag.INTEGER) {
    if (value < -32768 || value > 32767) {
      throw new Error('Value must be 16-bit signed integer (-32768 to 32767) for INTEGER tag');
    }
    encodedValue = value & 0xffff;
  } else {
    if (value < 0 || value > 65535) {
      throw new Error('Value must be 16-bit unsigned integer (0 to 65535)');
    }
    encodedValue = value;
  }

  const mantissaTagBits = (tag & 0x3f) << 16;
  return (EXPONENT_MASK | NAN_BIT | mantissaTagBits | encodedValue) >>> 0; // >>> 0 ensures unsigned 32-bit
}

/**
 * Decodes raw 32-bit unsigned integer bits into their constituent
 * components: value and tag. This function operates on raw bits to avoid
 * JavaScript's IEEE 754 float normalization corruption.
 *
 * @param rawBits The 32-bit unsigned integer bits representing the NaN-boxed value.
 * @returns An object containing the decoded components:
 *     -   `value`: The 16-bit value (sign-extended if it was a Tag.INTEGER).
 *     -   `tag`: The tag indicating the data type.
 */
export function fromTaggedValueRaw(rawBits: number): { value: number; tag: Tag } {
  // Convert to unsigned 32-bit
  const bits = rawBits >>> 0;
  
  // Check if this is a NaN (exponent bits are all 1s and NaN bit is set)
  const exponentBits = (bits >>> 23) & 0xff;
  const isNaN = exponentBits === 0xff && ((bits >>> 22) & 1) === 1;
  
  if (!isNaN) {
    // This is a regular IEEE 754 float - convert back to float value
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, bits, true);
    return { value: view.getFloat32(0, true), tag: Tag.NUMBER };
  }

  // Extract tag and value from NaN-boxed representation
  const tag = (bits >>> 16) & 0x3f;
  let value = bits & VALUE_MASK;

  // Sign-extend for INTEGER type
  if (tag === Tag.INTEGER && (value & 0x8000)) {
    value |= 0xffff0000; // Sign-extend to 32-bit signed integer
  }

  return { value, tag };
}

/**
 * Extracts just the tag from raw 32-bit unsigned integer bits.
 * This is more efficient than full decoding when only the tag is needed.
 *
 * @param rawBits The 32-bit unsigned integer bits representing the NaN-boxed value.
 * @returns The tag indicating the data type.
 */
export function getTagRaw(rawBits: number): Tag {
  const bits = rawBits >>> 0;
  const exponentBits = (bits >>> 23) & 0xff;
  const isNaN = exponentBits === 0xff && ((bits >>> 22) & 1) === 1;
  
  if (!isNaN) {
    return Tag.NUMBER;
  }
  
  return (bits >>> 16) & 0x3f;
}

/**
 * Extracts just the value from raw 32-bit unsigned integer bits.
 * This is more efficient than full decoding when only the value is needed.
 *
 * @param rawBits The 32-bit unsigned integer bits representing the NaN-boxed value.
 * @returns The 16-bit value (sign-extended if it was a Tag.INTEGER).
 */
export function getValueRaw(rawBits: number): number {
  const bits = rawBits >>> 0;
  const exponentBits = (bits >>> 23) & 0xff;
  const isNaN = exponentBits === 0xff && ((bits >>> 22) & 1) === 1;
  
  if (!isNaN) {
    // This is a regular IEEE 754 float - convert back to float value
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, bits, true);
    return view.getFloat32(0, true);
  }

  const tag = (bits >>> 16) & 0x3f;
  let value = bits & VALUE_MASK;

  // Sign-extend for INTEGER type
  if (tag === Tag.INTEGER && (value & 0x8000)) {
    value |= 0xffff0000; // Sign-extend to 32-bit signed integer
  }

  return value;
}
