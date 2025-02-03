export const Tag = {
  INTEGER: 0b001, // 1 (signed 20-bit integer)
  ADDRESS: 0b010, // 2 (unsigned 20-bit pointer)
  BLOCK: 0b011, // 3
  ARRAY: 0b100, // 4
  CUSTOM1: 0b101, // 5
  CUSTOM2: 0b110, // 6
  CUSTOM3: 0b111, // 7
};

export const TAG_ANY = 0;
export const TAG_NAN = 0;

// Constants
const TAG_BITS = 3; // 3 bits for the tag (2 bits in mantissa + 1 sign bit)
const POINTER_BITS = 20; // 20 bits for the pointer
const EXPONENT_MASK = 0xff << 23; // Exponent mask for NaN
const TAG_MANTISSA_MASK = 0b11 << POINTER_BITS; // Tag mask in mantissa (bits 20-21)
const POINTER_MASK = (1 << POINTER_BITS) - 1; // Pointer mask (bits 0-19)
const NAN_BIT = 1 << 22; // Force the 23rd bit of the mantissa to 1

/**
 * Returns the name of the tag given its value.
 * @param tagValue - The value of the tag (0..7).
 * @returns The name of the tag.
 */
export function tagName(tagValue: number): string {
  for (const [key, value] of Object.entries(Tag)) {
    if (value === tagValue) {
      return key;
    }
  }
  throw new Error(`Invalid tag value: ${tagValue}`);
}

/**
 * Encodes a 20-bit pointer and a 3-bit tag into a Float32 NaN value.
 * @param {number} tag - The 3-bit tag (1-7). The tag 0 is reserved for Infinity.
 * @param {number} value - The 20-bit pointer (0-1048575 for unsigned, -524288 to 524287 for signed).
 * @returns {number} - The encoded Float32 NaN value.
 */
export function toTagNum(tag: number, value: number): number {
  if (tag < 1 || tag > 7) {
    throw new Error(`Tag must be a ${TAG_BITS}-bit value (1-7)`);
  }

  let encodedPointer: number;

  if (tag === Tag.INTEGER) {
    // Handle signed integers (two's complement)
    if (value < -524288 || value > 524287) {
      throw new Error(
        `Pointer must be a 20-bit signed integer (-524288 to 524287)`
      );
    }
    encodedPointer = value & POINTER_MASK; // Convert to 20-bit two's complement
  } else {
    // Handle unsigned pointers
    if (value < 0 || value >= 1 << POINTER_BITS) {
      throw new Error(
        `Pointer must be a ${POINTER_BITS}-bit value (0-${
          (1 << POINTER_BITS) - 1
        })`
      );
    }
    encodedPointer = value;
  }

  // Extract the sign bit (third tag bit) and the mantissa tag bits
  const signBit = (tag & 0b100) << 29; // Third tag bit goes into the sign bit
  const mantissaTagBits = (tag & 0b11) << POINTER_BITS; // First two tag bits go into bits 20-21

  // Combine the sign bit, exponent, mantissa tag bits, and pointer
  const tagNum =
    signBit | EXPONENT_MASK | NAN_BIT | mantissaTagBits | encodedPointer;

  // Interpret the integer as a Float32
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, tagNum, true); // Little-endian
  return view.getFloat32(0, true); // Return as Float32
}

/**
 * Decodes a Float32 NaN value into a 3-bit tag and a 20-bit pointer.
 * @param {number} tagNum - The encoded Float32 NaN value.
 * @returns {Object} - An object containing the tag and pointer.
 */
export function fromTagNum(
  tag: number,
  tagNum: number
): {
  tag: number;
  value: number;
} {
  if (!isNaN(tagNum)) {
    throw new Error("Value is not a Tagged Pointer");
  }

  // Interpret the Float32 as a 32-bit integer
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, tagNum, true); // Little-endian
  const intValue = view.getUint32(0, true);

  // Extract the tag and pointer
  const signBit = (intValue >>> 31) & 0b1; // Third tag bit from the sign bit
  const mantissaTagBits = (intValue & TAG_MANTISSA_MASK) >>> POINTER_BITS; // First two tag bits from bits 20-21
  const dataTag = (signBit << 2) | mantissaTagBits; // Combine to form the 3-bit tag
  const dataPointer = intValue & POINTER_MASK; // Extract the 20-bit pointer

  if (tag !== TAG_ANY) {
    if (tag !== dataTag) {
      throw new Error(
        `Expected tag ${tagName(tag)}, got tag ${tagName(dataTag)}`
      );
    }
  }

  // Handle signed integers for the INTEGER tag
  if (dataTag === Tag.INTEGER) {
    const isNegative = (dataPointer & (1 << (POINTER_BITS - 1))) !== 0; // Check the sign bit
    const signedPointer = isNegative
      ? dataPointer - (1 << POINTER_BITS)
      : dataPointer; // Convert to signed
    return { tag: dataTag, value: signedPointer };
  }

  return { tag: dataTag, value: dataPointer };
}

/**
 * Checks if a value is an tagNum value.
 * @param {number} value - The value to check.
 * @returns {boolean} - True if the value is an tagNum value, false otherwise.
 */
export const isTagNum = isNaN;

/**
 * Extracts the tag from an tagNum value.
 * @param {number} tagNum - The encoded Float32 NaN value.
 * @returns {number} - The 3-bit tag.
 */
export function getTag(tagNum: number): number {
  return fromTagNum(TAG_ANY, tagNum).tag;
}

/**
 * Extracts the pointer from an tagNum value.
 * @param {number} tagNum - The encoded Float32 NaN value.
 * @returns {number} - The 20-bit pointer (signed for INTEGER tag, unsigned otherwise).
 */
export function getPointer(tagNum: number): number {
  return fromTagNum(TAG_ANY, tagNum).value;
}

export function isHeapObject(tag: number): boolean {
  return tag === Tag.BLOCK || tag === Tag.ARRAY;
}
