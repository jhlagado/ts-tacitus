export enum Tag {
  DONT_USE, // 0
  INTEGER, // 1
  CODE, // 2
  NIL, // 3
  NAN, // 4
  STRING, // 5
  CUSTOM, // 6
  BLOCK, // 7
  // Additional tags can be added up to 15
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
const VALUE_BITS = 19; // 19 bits for the value
const EXPONENT_MASK = 0xff << 23; // Exponent mask for NaN
const TAG_MANTISSA_MASK = 0b111 << VALUE_BITS; // Tag mask in mantissa (bits 19-21)
const VALUE_MASK = (1 << VALUE_BITS) - 1; // Value mask (bits 0-18)
const NAN_BIT = 1 << 22; // Set bit 22 of the mantissa to ensure NaN

export const TAG_ANY = 0;
export const UNDEF = toTaggedValue(Tag.NIL, 0);

/**
 * Encodes a 19-bit value and a 4-bit tag into a Float32 NaN value.
 * @param {number} tag - The 4-bit tag (0-15).
 * @param {number} value - The 19-bit value (0-524287 for unsigned, -262144 to 262143 for signed).
 * @returns {number} - The encoded Float32 NaN value.
 */
export function toTaggedValue(tag: Tag, value: number): number {
  if (tag > 15) {
    throw new Error(`Tag must be a 4-bit value (0-15)`);
  }

  let encodedValue: number;

  if (tag === Tag.INTEGER) {
    // Handle signed integers (two's complement)
    if (value < -(1 << (VALUE_BITS - 1)) || value >= (1 << (VALUE_BITS - 1))) {
      throw new Error(
        `Pointer must be a ${VALUE_BITS}-bit signed integer (-${1 << (VALUE_BITS - 1)} to ${(1 << (VALUE_BITS - 1)) - 1})`
      );
    }
    encodedValue = value & VALUE_MASK; // Convert to 19-bit two's complement
  } else {
    // Handle unsigned values
    if (value < 0 || value >= 1 << VALUE_BITS) {
      throw new Error(
        `Pointer must be a ${VALUE_BITS}-bit value (0-${(1 << VALUE_BITS) - 1})`
      );
    }
    encodedValue = value;
  }

  // Extract the sign bit (fourth tag bit) and the mantissa tag bits
  const signBit = (tag & 0b1000) << 28; // Fourth tag bit goes into the sign bit (bit 31)
  const mantissaTagBits = (tag & 0b0111) << VALUE_BITS; // First three tag bits go into bits 19-21

  // Combine the sign bit, exponent, mantissa tag bits, and value
  const tagNum =
    signBit | EXPONENT_MASK | NAN_BIT | mantissaTagBits | encodedValue;

  // Interpret the integer as a Float32
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, tagNum, true); // Little-endian
  return view.getFloat32(0, true); // Return as Float32
}

/**
 * Decodes a Float32 NaN value into a 4-bit tag and a 19-bit value.
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
  const signBit = (intValue >>> 31) & 0b1; // Fourth tag bit from the sign bit
  const mantissaTagBits = (intValue & TAG_MANTISSA_MASK) >>> VALUE_BITS; // First three tag bits from bits 19-21
  const dataTag = (signBit << 3) | mantissaTagBits; // Combine to form the 4-bit tag
  const dataValue = intValue & VALUE_MASK; // Extract the 19-bit value

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
    const isNegative = (dataValue & (1 << (VALUE_BITS - 1))) !== 0; // Check the sign bit
    const signedValue = isNegative
      ? dataValue - (1 << VALUE_BITS)
      : dataValue; // Convert to signed
    return { tag: dataTag, value: signedValue };
  }

  return { tag: dataTag, value: dataValue };
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
