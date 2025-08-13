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
  /**  Represents a standard floating-point number. */
  NUMBER = 0,

  /**  Represents a 16-bit integer. */
  INTEGER = 1,

  /**  Represents executable code (function pointer). */
  CODE = 2,

  /**  Represents a 4-byte aligned stack cell reference. */
  STACK_REF = 3,

  /**  Represents a string literal. */
  STRING = 4,

  /**  Represents a built-in operation opcode. */
  BUILTIN = 7,

  /**  Represents a reverse list with header at TOS and reverse payload. */
  LIST = 8,
}

/**
 * The highest valid tag value. Update this when adding new tags.
 * Used for validation and testing to avoid hardcoded enum values.
 */
export const MAX_TAG = Tag.LIST;

/**
 * Human-readable names for Tag values (for debugging).
 */
export const tagNames: { [key in Tag]: string } = {
  [Tag.NUMBER]: 'NUMBER',
  [Tag.INTEGER]: 'INTEGER',
  [Tag.CODE]: 'CODE',
  [Tag.STACK_REF]: 'STACK_REF',
  [Tag.STRING]: 'STRING',
  [Tag.BUILTIN]: 'BUILTIN',
  [Tag.LIST]: 'LIST',
};

/**
 * Constants used in the NaN-boxing scheme.
 */
const VALUE_BITS = 16;
const NAN_BIT = 1 << 22;
const TAG_MANTISSA_MASK = 0x7f << 16;
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
  if (tag < Tag.NUMBER || tag > MAX_TAG) {
    throw new Error(`Invalid tag: ${tag}`);
  }

  if (tag === Tag.NUMBER) {
    return value;
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
 * -   **Tag:** Extracted from bits 16-22 of the mantissa using TAG_MANTISSA_MASK.
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
  const tagBits = ((bits & TAG_MANTISSA_MASK) >>> 16) & 0x3f;
  const valueBits = bits & VALUE_MASK;
  const value = tagBits === Tag.INTEGER ? (valueBits << 16) >> 16 : valueBits;
  return { value, tag: tagBits };
}

/**
 * Extracts the `Tag` component from a NaN-boxed 32-bit floating-point number.
 * This function uses `fromTaggedValue` internally to decode the value.
 *
 * @param nanValue The NaN-boxed 32-bit floating-point number.
 * @returns The `Tag` enum value representing the type of the `nanValue`.
 */
export function getTag(nanValue: number): number {
  return fromTaggedValue(nanValue).tag;
}

/**
 * Extracts the raw value component from a NaN-boxed 32-bit floating-point number.
 * This function uses `fromTaggedValue` internally to decode the value.
 *
 * @param nanValue The NaN-boxed 32-bit floating-point number.
 * @returns The decoded numerical value contained within the `nanValue`.
 */
export function getValue(nanValue: number): number {
  return fromTaggedValue(nanValue).value;
}

/**
 * Checks if a given NaN-boxed value represents `NIL`.
 * `NIL` is defined as an `INTEGER` tag with a value of `0`.
 *
 * @param tval The NaN-boxed 32-bit floating-point number to check.
 * @returns `true` if the value is `NIL`, `false` otherwise.
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
 * Checks if a given NaN-boxed value represents a standard floating-point `NUMBER`.
 * This returns `true` if the value's tag is `Tag.NUMBER`.
 *
 * @param tval The NaN-boxed 32-bit floating-point number to check.
 * @returns `true` if the value is a `NUMBER`, `false` otherwise.
 */
export function isNumber(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.NUMBER;
}

/**
 * Checks if a given NaN-boxed value represents an `INTEGER`.
 * This returns `true` if the value's tag is `Tag.INTEGER`.
 *
 * @param tval The NaN-boxed 32-bit floating-point number to check.
 * @returns `true` if the value is an `INTEGER`, `false` otherwise.
 */
export function isInteger(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.INTEGER;
}

/**
 * Checks if a given NaN-boxed value represents executable `CODE` (a function pointer).
 * This returns `true` if the value's tag is `Tag.CODE`.
 *
 * @param tval The NaN-boxed 32-bit floating-point number to check.
 * @returns `true` if the value is `CODE`, `false` otherwise.
 */
export function isCode(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.CODE;
}

/**
 * Checks if a given NaN-boxed value represents executable `CODE`.
 *
 * @param tval The NaN-boxed 32-bit floating-point number to check.
 * @returns `true` if the value is `CODE`, `false` otherwise.
 */
export function isAnyCode(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.CODE;
}

/**
 * Checks if a given NaN-boxed value represents a `STRING` literal.
 * This returns `true` if the value's tag is `Tag.STRING`.
 *
 * @param tval The NaN-boxed 32-bit floating-point number to check.
 * @returns `true` if the value is a `STRING`, `false` otherwise.
 */
export function isString(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.STRING;
}

/**
 * Checks if a given NaN-boxed value represents an `LIST`.
 * This returns `true` if the value's tag is `Tag.LIST`.
 *
 * @param tval The NaN-boxed 32-bit floating-point number to check.
 * @returns `true` if the value is an `LIST`, `false` otherwise.
 */
export function isList(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.LIST;
}

/**
 * Checks if a given NaN-boxed value represents a STACK_REF.
 * @param tval The NaN-boxed value to check.
 * @returns true if the value is a STACK_REF, false otherwise.
 */
export function isStackRef(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.STACK_REF;
}

/**
 * Creates a STACK_REF pointing to the specified stack cell.
 * @param cellIndex The 4-byte aligned cell index (0-65535)
 * @returns Tagged STACK_REF value
 */
export function createStackRef(cellIndex: number): number {
  if (cellIndex < 0 || cellIndex > 65535) {
    throw new Error('Stack cell index must be 0-65535');
  }
  return toTaggedValue(cellIndex, Tag.STACK_REF);
}

/**
 * Gets the byte address from a STACK_REF.
 * @param stackRef The STACK_REF tagged value
 * @returns Byte address within stack segment
 */
export function getStackRefAddress(stackRef: number): number {
  if (getTag(stackRef) !== Tag.STACK_REF) {
    throw new Error('Value is not a STACK_REF');
  }
  return getValue(stackRef) * 4;
}
