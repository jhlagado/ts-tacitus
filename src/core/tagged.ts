/**
 * @file src/core/tagged.ts
 * This file implements NaN-boxing for the Tacit language, a technique used to
 * represent tagged values within 32-bit floating-point numbers. This allows the
 * language to efficiently store both a value and its type information without
 * requiring separate memory for the type.
 *
 * **Architectural Observations:**
 *
 * -   Tacit uses a 32-bit float to represent all values, including integers,
 *     and other types.
 * -   NaN-boxing is employed to embed type information (tags) within the float's
 *     mantissa, leveraging the fact that NaNs have unused bits in their
 *     representation.
 * -   The sign bit of the float is available for future use.
 * -   This approach provides a compact and efficient way to represent various
 *     data types, but it also has limitations:
 *     -   The value portion is limited to 16 bits.
 *     -   The number of distinct tags is limited by the available bits in the
 *         mantissa.
 */

/**
 * Tag types for values stored in the NaN-boxed value.
 */
export enum Tag {
  /** Represents a standard floating-point number. */
  NUMBER = 0,
  /** Represents a 16-bit integer. */
  INTEGER = 1,
  /** Represents executable code (function pointer). */
  CODE = 2,
  /** Represents an inline code block with its own scope. */
  CODE_BLOCK = 3,
  /** Represents a string literal. */
  STRING = 4,
}

/**
 * Human-readable names for Tag values (for debugging).
 */
export const tagNames: { [key in Tag]: string } = {
  [Tag.NUMBER]: 'NUMBER',
  [Tag.INTEGER]: 'INTEGER',
  [Tag.CODE]: 'CODE',
  [Tag.CODE_BLOCK]: 'CODE_BLOCK',
  [Tag.STRING]: 'STRING',
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
 * Encodes a value and its type tag into a single 32-bit floating-point number
 * using NaN-boxing.
 *
 * The NaN-boxing scheme uses the following structure:
 *
 * -   **Exponent (Bits 23-30):** Set to all 1s (0xff) to ensure the number is a NaN.
 * -   **Mantissa (Bits 0-22):**
 *     -   **Tag (Bits 16-21):**  6 bits representing the type tag (from Tag).
 *     -   **Value (Bits 0-15):** 16 bits representing the actual value. For
 *         Tag.INTEGER, this is a signed integer; otherwise, it's an
 *         unsigned integer.
 * -   **NaN Bit (Bit 22):** Set to 1 to indicate a quiet NaN.
 *
 * @param value The value to encode. For Tag.INTEGER, this should be a signed integer (-32768 to 32767); for
 *     other tags, it should be an unsigned integer (0 to 65535).
 * @param tag The tag representing the data type. This should be a value from Tag.
 * @returns A 32-bit floating-point number representing the NaN-boxed tagged value.
 * @throws {Error} If the tag or value is invalid.
 */
export function toTaggedValue(value: number, tag: Tag): number {
  // Validate the tag is a valid Tag
  if (tag < Tag.NUMBER || tag > Tag.STRING) {
    throw new Error(`Invalid tag: ${tag}`);
  }

  // Validate and encode the value.
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

  // Pack the 6-bit tag into bits 16–21.
  const mantissaTagBits = (tag & 0x3f) << 16;
  // Assemble the final 32-bit pattern.
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
 * This function reverses the process performed by `toTaggedValue`, extracting
 * the original value and its type information from the NaN-boxed representation.
 *
 * It handles standard floating-point numbers (which are not NaNs) as a special
 * case, returning them with a Tag.NUMBER tag.
 *
 * For NaN-boxed values, it extracts the components as follows:
 *
 * -   **Tag:** Extracted from bits 16-21 of the mantissa using TAG_MANTISSA_MASK.
 * -   **Value:** Extracted from bits 0-15 of the mantissa using `VALUE_MASK`. If
 *     the tag is Tag.INTEGER, the value is sign-extended to ensure correct
 *     interpretation as a 16-bit signed integer.
 *
 * @param nanValue The 32-bit floating-point number representing the potentially
 *     NaN-boxed value.
 * @returns An object containing the decoded components:
 *     -   `value`: The 16-bit value (sign-extended if it was a
 *         Tag.INTEGER.
 *     -   `tag`: The tag indicating the data type.
 */
export function fromTaggedValue(nanValue: number): { value: number; tag: Tag } {
  if (!isNaN(nanValue)) {
    return { value: nanValue, tag: Tag.NUMBER };
  }
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, nanValue, true);
  const bits = view.getUint32(0, true);

  // The tag is stored in bits 16–21.
  const tagBits = (bits & TAG_MANTISSA_MASK) >>> 16;
  // Extract the lower 16 bits as the value.
  const valueBits = bits & VALUE_MASK;
  // For INTEGER (Tag.INTEGER) we must sign–extend.
  const value = tagBits === Tag.INTEGER ? (valueBits << 16) >> 16 : valueBits;
  return { value, tag: tagBits };
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
 * Checks if the given value is NIL.
 */
export function isNIL(tval: number): boolean {
  const { tag, value } = fromTaggedValue(tval);
  return tag === Tag.INTEGER && value === 0;
}

/**
 * Checks if the given value is reference-counted.
 * @deprecated This function is kept for backward compatibility but always returns false.
 */
export function isRefCounted(_value: number): boolean {
  return false;
}

/**
 * Checks if the given value is a number.
 * Returns true for both tagged numbers and native JavaScript numbers.
 */
export function isNumber(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.NUMBER;
}

/**
 * Checks if the given value is an integer.
 */
export function isInteger(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.INTEGER;
}

/**
 * Checks if the given value is a function code value.
 */
export function isCode(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.CODE;
}

/**
 * Checks if the given value is a code block value.
 */
export function isCodeBlock(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.CODE_BLOCK;
}

/**
 * Checks if the given value is either a function or code block.
 */
export function isAnyCode(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.CODE || tag === Tag.CODE_BLOCK;
}

/**
 * Checks if the given value is a string.
 */
export function isString(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.STRING;
}
