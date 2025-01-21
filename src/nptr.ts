export const TAGS = {
  INTEGER: 0b001, // 1 (signed 20-bit integer)
  ADDRESS: 0b010, // 2 (unsigned 20-bit pointer)
  STRING: 0b011,  // 3
  ARRAY: 0b100,   // 4
  CUSTOM1: 0b101, // 5
  CUSTOM2: 0b110, // 6
  CUSTOM3: 0b111, // 7
};

// Constants
const TAG_BITS = 3; // 3 bits for the tag (2 bits in mantissa + 1 sign bit)
const POINTER_BITS = 20; // 20 bits for the pointer
const EXPONENT_MASK = 0xff << 23; // Exponent mask for NaN
const TAG_MANTISSA_MASK = 0b11 << POINTER_BITS; // Tag mask in mantissa (bits 20-21)
const POINTER_MASK = (1 << POINTER_BITS) - 1; // Pointer mask (bits 0-19)
const NAN_BIT = 1 << 22; // Force the 23rd bit of the mantissa to 1

/**
 * Encodes a 20-bit pointer and a 3-bit tag into a Float32 NaN value.
 * @param {number} tag - The 3-bit tag (1-7). The tag 0 is reserved for Infinity.
 * @param {number} pointer - The 20-bit pointer (0-1048575 for unsigned, -524288 to 524287 for signed).
 * @returns {number} - The encoded Float32 NaN value.
 */
export function encodeNPtr(tag: number, pointer: number): number {
  if (tag < 1 || tag > 7) {
    throw new Error(`Tag must be a ${TAG_BITS}-bit value (1-7)`);
  }

  let encodedPointer: number;

  if (tag === TAGS.INTEGER) {
    // Handle signed integers (two's complement)
    if (pointer < -524288 || pointer > 524287) {
      throw new Error(`Pointer must be a 20-bit signed integer (-524288 to 524287)`);
    }
    encodedPointer = pointer & POINTER_MASK; // Convert to 20-bit two's complement
  } else {
    // Handle unsigned pointers
    if (pointer < 0 || pointer >= 1 << POINTER_BITS) {
      throw new Error(`Pointer must be a ${POINTER_BITS}-bit value (0-${(1 << POINTER_BITS) - 1})`);
    }
    encodedPointer = pointer;
  }

  // Extract the sign bit (third tag bit) and the mantissa tag bits
  const signBit = (tag & 0b100) << 29; // Third tag bit goes into the sign bit
  const mantissaTagBits = (tag & 0b11) << POINTER_BITS; // First two tag bits go into bits 20-21

  // Combine the sign bit, exponent, mantissa tag bits, and pointer
  const nPtr = signBit | EXPONENT_MASK | NAN_BIT | mantissaTagBits | encodedPointer;

  // Interpret the integer as a Float32
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, nPtr, true); // Little-endian
  return view.getFloat32(0, true); // Return as Float32
}

/**
 * Decodes a Float32 NaN value into a 3-bit tag and a 20-bit pointer.
 * @param {number} nPtr - The encoded Float32 NaN value.
 * @returns {Object} - An object containing the tag and pointer.
 */
export function decodeNPtr(nPtr: number): { tag: number; pointer: number } {
  if (!isNaN(nPtr)) {
    throw new Error("Value is not a NaN");
  }

  // Interpret the Float32 as a 32-bit integer
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, nPtr, true); // Little-endian
  const intValue = view.getUint32(0, true);

  // Extract the tag and pointer
  const signBit = (intValue >>> 31) & 0b1; // Third tag bit from the sign bit
  const mantissaTagBits = (intValue & TAG_MANTISSA_MASK) >>> POINTER_BITS; // First two tag bits from bits 20-21
  const tag = (signBit << 2) | mantissaTagBits; // Combine to form the 3-bit tag
  const pointer = intValue & POINTER_MASK; // Extract the 20-bit pointer

  // Handle signed integers for the INTEGER tag
  if (tag === TAGS.INTEGER) {
    const isNegative = (pointer & (1 << (POINTER_BITS - 1))) !== 0; // Check the sign bit
    const signedPointer = isNegative ? pointer - (1 << POINTER_BITS) : pointer; // Convert to signed
    return { tag, pointer: signedPointer };
  }

  return { tag, pointer };
}

/**
 * Checks if a value is an NPtr value.
 * @param {number} value - The value to check.
 * @returns {boolean} - True if the value is an NPtr value, false otherwise.
 */
export function isNPtr(value: number): boolean {
  return isNaN(value);
}

/**
 * Extracts the tag from an NPtr value.
 * @param {number} nPtr - The encoded Float32 NaN value.
 * @returns {number} - The 3-bit tag.
 */
export function getTag(nPtr: number): number {
  return decodeNPtr(nPtr).tag;
}

/**
 * Extracts the pointer from an NPtr value.
 * @param {number} nPtr - The encoded Float32 NaN value.
 * @returns {number} - The 20-bit pointer (signed for INTEGER tag, unsigned otherwise).
 */
export function getPointer(nPtr: number): number {
  return decodeNPtr(nPtr).pointer;
}