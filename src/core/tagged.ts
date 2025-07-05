/**
 * @file src/core/tagged.ts
 * A minimal implementation of NaN-boxing for the Tacit language
 * without heap-allocated types.
 */

/**
 * Enum representing core data types in Tacit.
 */
export enum CoreTag {
  /** Represents a standard floating-point number. */
  NUMBER = 0,
  /** Represents a 16-bit integer. */
  INTEGER = 1,
  /** Represents executable code. */
  CODE = 2,
  /** Represents a string literal. */
  STRING = 3,
}

/**
 * Type alias for a Tag.
 */
export type Tag = CoreTag;

/**
 * Human-readable names for CoreTag values (for debugging).
 */
export const tagNames: { [key in CoreTag]: string } = {
  [CoreTag.NUMBER]: 'NUMBER',
  [CoreTag.INTEGER]: 'INTEGER',
  [CoreTag.CODE]: 'CODE',
  [CoreTag.STRING]: 'STRING',
};

/**
 * Constants used in the NaN-boxing scheme.
 */
const VALUE_BITS = 16;
const NAN_BIT = 1 << 22;
const TAG_MANTISSA_MASK = 0x3f << 16; // 6 bits available for the tag (bits 16-21)
const VALUE_MASK = (1 << VALUE_BITS) - 1;
const EXPONENT_MASK = 0xff << 23;

/**
 * NIL constant: a non-heap tagged value representing the absence of a value.
 * It has a CoreTag.INTEGER tag and a value of 0.
 */
export const NIL = toTaggedValue(0, false, CoreTag.INTEGER);

/**
 * Encodes a value and its type tag into a single 32-bit floating-point number
 * using NaN-boxing.
 * 
 * @param value A 16-bit number representing the value to be encoded.
 * @param isHeap Not used in simplified version, kept for API compatibility.
 * @param tag The tag representing the data type from CoreTag.
 * @returns A 32-bit floating-point number representing the NaN-boxed tagged value.
 */
export function toTaggedValue(value: number, isHeap: boolean, tag: Tag): number {
  // Validate the tag
  if (tag < 0 || tag > 3) {
    throw new Error(`Invalid tag: ${tag}`);
  }

  // Validate the value range
  if (tag === CoreTag.INTEGER) {
    // For INTEGER type, ensure value fits in 16-bit signed integer range
    if (value < -32768 || value > 32767) {
      throw new Error(`Integer value out of range: ${value}`);
    }
    // Ensure the value is an integer
    value = Math.trunc(value);
  } else {
    // For other types, ensure value fits in 16-bit unsigned integer range
    if (value < 0 || value > 65535) {
      throw new Error(`Value out of range: ${value}`);
    }
  }

  // Encode the value
  const encodedValue = value & VALUE_MASK;
  const mantissaTagBits = tag << 16;
  const bits = EXPONENT_MASK | NAN_BIT | mantissaTagBits | encodedValue;
  
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, bits, true);
  return view.getFloat32(0, true);
}

/**
 * Decodes a NaN-boxed 32-bit floating-point number into its constituent
 * components: value and tag.
 *
 * @param nanValue The 32-bit floating-point number representing the potentially
 *     NaN-boxed value.
 * @returns An object containing the decoded components:
 *     - `value`: The 16-bit value
 *     - `isHeap`: Always false in simplified version
 *     - `tag`: The tag indicating the data type
 */
export function fromTaggedValue(nanValue: number): {
  value: number;
  isHeap: boolean;
  tag: Tag;
} {
  if (!isNaN(nanValue)) {
    return { value: nanValue, isHeap: false, tag: CoreTag.NUMBER };
  }
  
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, nanValue, true);
  const bits = view.getUint32(0, true);

  // The tag is stored in bits 16–21
  const tagBits = (bits & TAG_MANTISSA_MASK) >>> 16;
  
  // Extract the lower 16 bits as the value
  const valueBits = bits & VALUE_MASK;
  
  // For INTEGER we must sign–extend
  const value = tagBits === CoreTag.INTEGER ? (valueBits << 16) >> 16 : valueBits;
  
  return { value, isHeap: false, tag: tagBits as CoreTag };
}

/**
 * Returns the tag component from a tagged value.
 */
export function getTag(nanValue: number): number {
  return fromTaggedValue(nanValue).tag;
}

/**
 * Returns the value component from a tagged value.
 */
export function getValue(nanValue: number): number {
  return fromTaggedValue(nanValue).value;
}

/**
 * Helper function for type checking. Checks if a value matches the specified tag.
 */
function checkTagged(value: number, expectedTag: Tag | null): boolean {
  if (isNaN(value)) {
    const { tag } = fromTaggedValue(value);
    return expectedTag === null || tag === expectedTag;
  }
  // Special case for regular JS numbers
  return expectedTag === null || expectedTag === CoreTag.NUMBER;
}

/**
 * Checks if the given value is NIL.
 */
export function isNIL(tagVal: number): boolean {
  if (checkTagged(tagVal, CoreTag.INTEGER)) {
    return getValue(tagVal) === 0;
  }
  return false;
}

/**
 * Checks if the given value is a number.
 * Returns true for both tagged numbers and native JavaScript numbers.
 */
export function isNumber(value: number): boolean {
  return !isNaN(value) || checkTagged(value, CoreTag.NUMBER);
}

/**
 * Checks if the given value is an integer.
 */
export function isInteger(value: number): boolean {
  return checkTagged(value, CoreTag.INTEGER);
}

/**
 * Checks if the given value is a code value.
 */
export function isCode(value: number): boolean {
  return checkTagged(value, CoreTag.CODE);
}

/**
 * Checks if the given value is a string.
 */
export function isString(value: number): boolean {
  return checkTagged(value, CoreTag.STRING);
}
