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
 *     heap pointers, and other types.
 * -   NaN-boxing is employed to embed type information (tags) within the float's
 *     mantissa, leveraging the fact that NaNs have unused bits in their
 *     representation.
 * -   The sign bit of the float is used to distinguish between heap-allocated
 *     values (sign bit set) and non-heap values (sign bit clear).
 * -   This approach provides a compact and efficient way to represent various
 *     data types, but it also has limitations:
 *     -   The value portion is limited to 16 bits.
 *     -   The number of distinct tags is limited by the available bits in the
 *         mantissa.
 */

/**
 * Enum representing core (non-heap) data types in Tacit.
 */
export enum CoreTag {
  /** Represents a standard floating-point number. */
  NUMBER = 0,
  /** Represents a 16-bit integer. */
  INTEGER = 1,
  /** Represents executable code (likely a function pointer or similar). */
  CODE = 2,
  /** Represents a string literal. */
  STRING = 3,
}

/**
 * Enum representing heap-allocated data types in Tacit.
 */
export enum HeapTag {
  /** Represents a generic heap block. */
  BLOCK = 0,
  /** Represents a sequence (an iterable collection). */
  SEQ = 1,
  /** Represents a vector (an array-like structure). */
  VECTOR = 2,
  /** Represents a dictionary (a key-value store). */
  DICT = 3,
}

/**
 * Type alias for a Tag, which can be either a CoreTag or a HeapTag.
 */
export type Tag = CoreTag | HeapTag;

/**
 * Human-readable names for CoreTag values (for debugging).
 */
export const nonHeapTagNames: { [key in CoreTag]: string } = {
  [CoreTag.NUMBER]: 'NUMBER',
  [CoreTag.INTEGER]: 'INTEGER',
  [CoreTag.CODE]: 'CODE',
  [CoreTag.STRING]: 'STRING',
};

/**
 * Human-readable names for HeapTag values (for debugging).
 */
export const heapTagNames: { [key in HeapTag]: string } = {
  [HeapTag.BLOCK]: 'BLOCK',
  [HeapTag.SEQ]: 'SEQ',
  [HeapTag.VECTOR]: 'VECTOR',
  [HeapTag.DICT]: 'DICT',
};

/**
 * Constants used in the NaN-boxing scheme.
 */
const VALUE_BITS = 16;
const NAN_BIT = 1 << 22;
const SIGN_BIT = 1 << 31;
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
 * The NaN-boxing scheme uses the following structure:
 *
 * -   **Sign Bit (Bit 31):** Indicates whether the value is heap-allocated (1) or
 *     non-heap (0).
 * -   **Exponent (Bits 23-30):** Set to all 1s (0xff) to ensure the number is a NaN.
 * -   **Mantissa (Bits 0-22):**
 *     -   **Tag (Bits 16-21):**  6 bits representing the type tag (from CoreTag or HeapTag).
 *     -   **Value (Bits 0-15):** 16 bits representing the actual value.  For
 *         `CoreTag.INTEGER`, this is a signed integer; otherwise, it's an
 *         unsigned integer.
 * -   **NaN Bit (Bit 22):** Set to 1 to indicate a quiet NaN.
 *
 * @param value A 16-bit number representing the value to be encoded. For
 *     `CoreTag.INTEGER`, this should be a signed integer (-32768 to 32767); for
 *     other tags, it should be an unsigned integer (0 to 65535).
 * @param heap A boolean flag indicating whether the value is heap-allocated. If
 *     `true`, the sign bit will be set, and the tag will be interpreted as a
 *     `HeapTag`. If `false`, the sign bit will be clear, and the tag will be
 *     interpreted as a `CoreTag`.
 * @param tag The tag representing the data type.  If `heap` is `false`, this
 *     should be a value from `CoreTag`; if `heap` is `true`, it should be a value
 *     from `HeapTag`.
 * @returns A 32-bit floating-point number representing the NaN-boxed tagged
 *     value.
 * @throws {Error} If the tag or value is invalid for the given `heap` setting.
 */
export function toTaggedValue(value: number, heap: boolean, tag: Tag): number {
  // Validate the tag based on whether the value is heap–allocated.
  if (heap) {
    // Heap tags must be between HeapTag.BLOCK and HeapTag.DICT.
    if (tag < HeapTag.BLOCK || tag > HeapTag.DICT) {
      throw new Error('Invalid heap tag');
    }
  } else {
    // Non–heap tags must be between NonHeapTag.NIL and NonHeapTag.STRING.
    if (tag < CoreTag.INTEGER || tag > CoreTag.STRING) {
      throw new Error('Invalid non-heap tag');
    }
  }

  // Validate and encode the value.
  let encodedValue: number;
  if (!heap && tag === CoreTag.INTEGER) {
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

  // Set the sign bit if heap allocated.
  const signBit = heap ? SIGN_BIT : 0;
  // Pack the 6-bit tag into bits 16–21.
  const mantissaTagBits = (tag & 0x3f) << 16;
  // Assemble the final 32-bit pattern.
  const bits = signBit | EXPONENT_MASK | NAN_BIT | mantissaTagBits | encodedValue;
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, bits, true);
  return view.getFloat32(0, true);
}

/**
 * Decodes a NaN-boxed 32-bit floating-point number into its constituent
 * components: value, heap flag, and tag.
 *
 * This function reverses the process performed by `toTaggedValue`, extracting
 * the original value and its type information from the NaN-boxed representation.
 *
 * It handles standard floating-point numbers (which are not NaNs) as a special
 * case, returning them with a `CoreTag.NUMBER` tag and `heap` set to `false`.
 *
 * For NaN-boxed values, it extracts the components as follows:
 *
 * -   **Heap Flag:** Determined by checking the sign bit (bit 31). If the sign
 *     bit is set, `heap` is `true`; otherwise, it's `false`.
 * -   **Tag:** Extracted from bits 16-21 of the mantissa using
 *     `TAG_MANTISSA_MASK`.
 * -   **Value:** Extracted from bits 0-15 of the mantissa using `VALUE_MASK`. If
 *     the tag is `CoreTag.INTEGER` and the value is not heap-allocated (`heap`
 *     is `false`), the value is sign-extended to ensure correct interpretation
 *     as a 16-bit signed integer.
 *
 * @param nanValue The 32-bit floating-point number representing the potentially
 *     NaN-boxed value.
 * @returns An object containing the decoded components:
 *     -   `value`: The 16-bit value (sign-extended if it was a
 *         `CoreTag.INTEGER` and not heap-allocated).
 *     -   `heap`: A boolean indicating if the value was heap-allocated.
 *     -   `tag`: The tag indicating the data type.
 */
export function fromTaggedValue(nanValue: number): {
  value: number;
  heap: boolean;
  tag: Tag;
} {
  if (!isNaN(nanValue)) {
    return { value: nanValue, heap: false, tag: CoreTag.NUMBER };
  }
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, nanValue, true);
  const bits = view.getUint32(0, true);

  // Determine if the value is heap allocated by checking the sign bit.
  const heap = (bits & SIGN_BIT) !== 0;
  // The tag is stored in bits 16–21.
  const tagBits = (bits & TAG_MANTISSA_MASK) >>> 16;
  // Extract the lower 16 bits as the value.
  const valueBits = bits & VALUE_MASK;
  // For INTEGER (NonHeapTag.INTEGER) we must sign–extend.
  const value = !heap && tagBits === CoreTag.INTEGER ? (valueBits << 16) >> 16 : valueBits;
  return { value, heap, tag: tagBits };
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
 * Helper function for type checking. Checks if a value matches the specified tag and heap status.
 * @param value The value to check
 * @param expectedTag The expected tag value, or null to check only heap status
 * @param expectedHeap The expected heap status (true for heap-allocated, false for non-heap)
 * @returns True if the value matches the expected tag and heap status
 */
function checkTagged(value: number, expectedTag: Tag | null, expectedHeap: boolean): boolean {
  if (isNaN(value)) {
    const { tag, heap } = fromTaggedValue(value);
    return heap === expectedHeap && (expectedTag === null || tag === expectedTag);
  }
  // Special case for regular JS numbers
  return !expectedHeap && (expectedTag === null || expectedTag === CoreTag.NUMBER) && !isNaN(value);
}

/**
 * Checks if the given value is heap-allocated.
 */
export function isHeapAllocated(value: number): boolean {
  return checkTagged(value, null, true);
}

/**
 * Checks if the given value is NIL.
 */
export function isNIL(tagVal: number): boolean {
  if (checkTagged(tagVal, CoreTag.INTEGER, false)) {
    return getValue(tagVal) === 0;
  }
  return false;
}

/**
 * Checks if the given value is reference-counted.
 */
export function isRefCounted(value: number): boolean {
  return isHeapAllocated(value);
}

/**
 * Checks if the given value is a number.
 * Returns true for both tagged numbers and native JavaScript numbers.
 */
export function isNumber(value: number): boolean {
  return !isNaN(value) || checkTagged(value, CoreTag.NUMBER, false);
}

/**
 * Checks if the given value is an integer.
 */
export function isInteger(value: number): boolean {
  return checkTagged(value, CoreTag.INTEGER, false);
}

/**
 * Checks if the given value is a code value.
 */
export function isCode(value: number): boolean {
  return checkTagged(value, CoreTag.CODE, false);
}

/**
 * Checks if the given value is a string.
 */
export function isString(value: number): boolean {
  return checkTagged(value, CoreTag.STRING, false);
}

/**
 * Checks if the given value is a sequence.
 */
export function isSeq(value: number): boolean {
  return checkTagged(value, HeapTag.SEQ, true);
}

/**
 * Checks if the given value is a vector.
 */
export function isVector(value: number): boolean {
  return checkTagged(value, HeapTag.VECTOR, true);
}

/**
 * Checks if the given value is a dictionary.
 */
export function isDict(value: number): boolean {
  return checkTagged(value, HeapTag.DICT, true);
}

/**
 * Prints a formatted representation of a tagged value.
 */
export function printNum(...args: unknown[]): void {
  const format = (num: number): string => {
    if (isNaN(num)) {
      return num.toString();
    } else {
      const { heap, tag, value } = fromTaggedValue(num);
      let tagName: string;
      if (heap) {
        tagName = heapTagNames[tag as HeapTag] || `HeapTag(${tag})`;
      } else {
        tagName = nonHeapTagNames[tag as CoreTag] || `NonHeapTag(${tag})`;
      }
      return `Heap: ${heap}, Tag: ${tag} (${tagName}), Value: ${value}`;
    }
  };
  console.log(args.map(arg => (typeof arg === 'number' ? format(arg) : String(arg))).join(' '));
}
