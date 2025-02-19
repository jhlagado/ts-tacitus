export enum Tag {
  DONT_USE, // 0
  INTEGER, // 1
  CODE, // 2
  NIL, // 3
  NAN, // 4
  STRING, // 5
  CUSTOM, // 6
  BLOCK, // 7
}

export const tagNames: { [key in Tag]: string } = {
  [Tag.DONT_USE]: "DONT_USE",
  [Tag.INTEGER]: "INTEGER",
  [Tag.CODE]: "CODE",
  [Tag.NIL]: "UNDEF",
  [Tag.NAN]: "NAN",
  [Tag.STRING]: "VECTOR",
  [Tag.CUSTOM]: "VIEW",
  [Tag.BLOCK]: "SEQ",
};

// Constants
const VALUE_BITS = 20; // 20 bits for the value
const EXPONENT_MASK = 0xff << 23; // Exponent mask for NaN
const TAG_MANTISSA_MASK = 0b11 << VALUE_BITS; // Tag mask in mantissa (bits 20-21)
const VALUE_MASK = (1 << VALUE_BITS) - 1; // Pointer mask (bits 0-19)
const NAN_BIT = 0; // Force the 23rd bit of the mantissa to 1

export const TAG_ANY = 0;
export const UNDEF = toTaggedValue(Tag.NIL, 0);

/**
 * Encodes a 20-bit value and a 3-bit tag into a Float32 NaN value.
 * @param {number} tag - The 3-bit tag (1-7). The tag 0 is reserved for Infinity.
 * @param {number} value - The 20-bit value (0-1048575 for unsigned, -524288 to 524287 for signed).
 * @returns {number} - The encoded Float32 NaN value.
 */
export function toTaggedValue(tag: Tag, value: number): number {
  if (tag > 7) {
    throw new Error(`Tag must be a 3-bit value (0-7)`);
  }

  let encodedPointer: number;

  if (tag === Tag.INTEGER) {
    // Handle signed integers (two's complement)
    if (value < -524288 || value > 524287) {
      throw new Error(
        `Pointer must be a 20-bit signed integer (-524288 to 524287)`
      );
    }
    encodedPointer = value & VALUE_MASK; // Convert to 20-bit two's complement
  } else {
    // Handle unsigned values
    if (value < 0 || value >= 1 << VALUE_BITS) {
      throw new Error(
        `Pointer must be a ${VALUE_BITS}-bit value (0-${(1 << VALUE_BITS) - 1})`
      );
    }
    encodedPointer = value;
  }

  // Extract the sign bit (third tag bit) and the mantissa tag bits
  const signBit = (tag & 0b100) << 29; // Third tag bit goes into the sign bit
  const mantissaTagBits = (tag & 0b11) << VALUE_BITS; // First two tag bits go into bits 20-21

  // Combine the sign bit, exponent, mantissa tag bits, and value
  const tagNum =
    signBit | EXPONENT_MASK | NAN_BIT | mantissaTagBits | encodedPointer;

  // Interpret the integer as a Float32
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, tagNum, true); // Little-endian
  return view.getFloat32(0, true); // Return as Float32
}

/**
 * Decodes a Float32 NaN value into a 3-bit tag and a 20-bit value.
 * @param {number} tagNum - The encoded Float32 NaN value.
 * @returns {Object} - An object containing the tag and value.
 */
export function fromTaggedValue(
  tag: Tag,
  tagNum: number
): {
  tag: number;
  value: number;
} {
  if (!isTaggedValue(tagNum)) {
    throw new Error("Value is not a Tagged Pointer");
  }

  // Interpret the Float32 as a 32-bit integer
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, tagNum, true); // Little-endian
  const intValue = view.getUint32(0, true);

  // Extract the tag and value
  const signBit = (intValue >>> 31) & 0b1; // Third tag bit from the sign bit
  const mantissaTagBits = (intValue & TAG_MANTISSA_MASK) >>> VALUE_BITS; // First two tag bits from bits 20-21
  const dataTag = (signBit << 2) | mantissaTagBits; // Combine to form the 3-bit tag
  const dataPointer = intValue & VALUE_MASK; // Extract the 20-bit value

  if (tag !== TAG_ANY) {
    if (tag !== dataTag) {
      throw new Error(
        `Expected tag ${tagNames[tag as Tag]}, got tag ${
          tagNames[dataTag as Tag]
        }`
      );
    }
  }

  // Handle signed integers for the INTEGER tag
  if (dataTag === Tag.INTEGER) {
    const isNegative = (dataPointer & (1 << (VALUE_BITS - 1))) !== 0; // Check the sign bit
    const signedPointer = isNegative
      ? dataPointer - (1 << VALUE_BITS)
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
export const isTaggedValue = isNaN;

/**
 * Extracts the tag from an tagNum value.
 * @param {number} tagNum - The encoded Float32 NaN value.
 * @returns {number} - The 3-bit tag.
 */
export function getTag(tagNum: number): number {
  return fromTaggedValue(TAG_ANY, tagNum).tag;
}

/**
 * Extracts the value from an tagNum value.
 * @param {number} tagNum - The encoded Float32 NaN value.
 * @returns {number} - The 20-bit value (signed for INTEGER tag, unsigned otherwise).
 */
export function getValue(tagNum: number): number {
  return fromTaggedValue(TAG_ANY, tagNum).value;
}

export function isRefCounted(tagNum: number): boolean {
  if (!isTaggedValue(tagNum)) {
    return false;
  }
  const { tag } = fromTaggedValue(TAG_ANY, tagNum);
  return tag === Tag.BLOCK;
}

export function isNIL(tagNum: number): boolean {
  if (!isTaggedValue(tagNum)) {
    return false;
  }
  const { tag } = fromTaggedValue(TAG_ANY, tagNum);
  return tag === Tag.NIL;
}
