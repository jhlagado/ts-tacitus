// tagged.ts

/**
 * New tagging scheme:
 *
 * Primitives:
 *   FLOAT:   PrimitiveTag = 0         → 31 bits for float (assumed to have a 22-bit mantissa)
 *   CODE:    PrimitiveTag = 100       → 29 bits for address (4-byte alignment)
 *   STRING:  PrimitiveTag = 101       → 29 bits for address (4-byte alignment)
 *   INTEGER: PrimitiveTag = 110       → 29 bits for signed integer (0 used for NIL)
 *   HEAP:    PrimitiveTag = 111       → Indicates a heap pointer, with extra subtype bits.
 *
 * Heap allocated types (for values with primary tag HEAP):
 *   BLOCK:   Subtype = 000   → Combined tag: 111 000
 *   VECTOR:  Subtype = 001   → Combined tag: 111 001
 *   SEQ:     Subtype = 010   → Combined tag: 111 010
 *   DICT:    Subtype = 011   → Combined tag: 111 011
 *   (Room for four additional heap types.)
 */

export enum PrimitiveTag {
  FLOAT = 0, // 0
  CODE = 4, // 100 in binary
  STRING = 5, // 101
  INTEGER = 6, // 110
  HEAP = 7, // 111
}

export enum HeapSubType {
  BLOCK = 0, // 000
  VECTOR = 1, // 001
  SEQ = 2, // 010
  DICT = 3, // 011
  // Additional 4 heap types can be added: 4, 5, 6, 7.
}

// Constants for bit widths.

// For CODE, STRING, INTEGER: 3-bit tag + 29-bit value.
const PRIMITIVE_VALUE_BITS = 29;

// For HEAP values: 3-bit primary tag, 3-bit heap subtype, then remaining bits for the address.
// We assume that heap addresses are 64-byte aligned so that their lower 6 bits are always zero.

// We define NIL as the integer tagged value with a value of 0.
export const NIL = toTaggedValue(0, PrimitiveTag.INTEGER);

/**
 * Encodes a value into our tagged representation.
 *
 * @param tag - One of the PrimitiveTag values.
 * @param value - The data portion (29 bits for CODE, STRING, INTEGER; 31 bits for FLOAT).
 * @param heapSubtype - When using HEAP tag, the subtype (HeapSubType) must be provided.
 */
export function toTaggedValue(
  value: number,
  tag: PrimitiveTag,
  heapSubtype?: HeapSubType
): number {
  let encoded: number;
  switch (tag) {
    case PrimitiveTag.FLOAT:
      // Here we assume that 'value' is already in an appropriate 31-bit encoded form.
      // In practice you might pack an IEEE754 float into these bits.
      encoded = value;
      break;
    case PrimitiveTag.CODE:
    case PrimitiveTag.STRING:
    case PrimitiveTag.INTEGER:
      // Ensure the value fits in 29 bits. For INTEGER, the value is signed.
      const minVal = -(1 << (PRIMITIVE_VALUE_BITS - 1));
      const maxVal = (1 << (PRIMITIVE_VALUE_BITS - 1)) - 1;
      if (tag === PrimitiveTag.INTEGER) {
        if (value < minVal || value > maxVal) {
          throw new Error(
            "INTEGER value out of range for 29-bit signed integer"
          );
        }
      } else {
        if (value < 0 || value >= 1 << PRIMITIVE_VALUE_BITS) {
          throw new Error("Value out of range for primitive type");
        }
      }
      // Left-shift the value by 3 bits and OR in the 3-bit tag.
      encoded = (value << 3) | tag;
      break;
    case PrimitiveTag.HEAP:
      if (heapSubtype === undefined) {
        throw new Error("Heap subtype must be provided for HEAP tagged values");
      }
      // For HEAP pointers, assume 'value' is the address.
      // Given 64-byte alignment, the lower 6 bits of 'value' must be 0.
      if ((value & 0x3f) !== 0) {
        throw new Error(
          "Heap address must be 64-byte aligned (lower 6 bits zero)"
        );
      }
      // Encode as: [address >> 6] << 6 OR ([heapSubtype] << 3) OR (HEAP tag)
      encoded = (value >> 6) << 6; // Preserve upper bits.
      encoded |= (heapSubtype << 3) | PrimitiveTag.HEAP;
      break;
    default:
      throw new Error("Unsupported tag");
  }
  return encoded;
}

/**
 * Decodes a tagged value and asserts that it matches the expected primitive tag.
 *
 * The encoded value is assumed to follow our custom tagging scheme:
 * - The lower 3 bits represent the primary tag.
 * - For FLOAT (tag 0): the entire 32 bits represent the float.
 * - For CODE (tag 4) and STRING (tag 5): the value is stored in the upper 29 bits.
 *   An unsigned right shift (>>>) by 3 recovers the original 29-bit address.
 * - For INTEGER (tag 6): the value is stored in the upper 29 bits and is
 *   interpreted as a signed integer, so an arithmetic right shift (>>) is used.
 * - For HEAP (tag 7): the next 3 bits (bits 3–5) encode the heap subtype,
 *   and the remaining bits (after shifting right 6) represent the heap address.
 *   The heap address is restored to its original form by shifting back left by 6.
 *
 * @param expectedTag - The expected primary tag (a value from PrimitiveTag).
 * @param encoded - The encoded tagged value.
 * @returns An object containing:
 *   - tag: The primary tag (will equal expectedTag).
 *   - value: The decoded numeric value.
 *   - heapSubtype: If the tag is HEAP, the decoded heap subtype.
 *
 * @throws {Error} If the encoded value's tag does not match the expectedTag.
 */
export function fromTaggedValue(
  encoded: number,
  expectedTag?: PrimitiveTag,
  expectedHeapSubtype?: HeapSubType
): { tag: PrimitiveTag; value: number; heapSubtype?: HeapSubType } {
  // Extract the primary tag from the lower 3 bits.
  const tag = encoded & 0x7;

  // Check against the expected tag, if provided.
  if (expectedTag !== undefined && tag !== expectedTag) {
    throw new Error(
      `PrimitiveTag mismatch: expected ${expectedTag}, got ${tag}`
    );
  }

  let value: number;
  let heapSubtype;

  switch (tag) {
    case PrimitiveTag.FLOAT:
      // For FLOAT, assume the entire 32 bits represent the float.
      value = encoded;
      break;
    case PrimitiveTag.CODE:
    case PrimitiveTag.STRING:
      // For CODE and STRING, use an unsigned right shift to recover the 29-bit address.
      value = encoded >>> 3;
      break;
    case PrimitiveTag.INTEGER:
      // For INTEGER, perform an arithmetic (signed) right shift.
      value = encoded >> 3;
      break;
    case PrimitiveTag.HEAP:
      // Extract the heap subtype from the next 3 bits.
      heapSubtype = (encoded >> 3) & 0x7;

      if (
        expectedHeapSubtype !== undefined &&
        heapSubtype !== expectedHeapSubtype
      ) {
        throw new Error(
          `Heap Subtype mismatch: expected ${expectedHeapSubtype}, got ${heapSubtype}`
        );
      }

      // The remaining bits (after shifting right 6 bits) hold the heap address.
      value = encoded >> 6;
      // Restore the 64-byte alignment by shifting left 6 bits.
      value = value << 6;
      break;
    default:
      throw new Error("Unsupported tag in encoded value");
  }

  return { tag, value, heapSubtype };
}

/**
 * Determines if a given number is a tagged value produced by toTaggedValue.
 *
 * In our implementation we assume that all tagged values are integers with a valid 3-bit tag.
 */
export function isTaggedValue(val: number): boolean {
  return (
    Number.isInteger(val) &&
    [
      PrimitiveTag.FLOAT,
      PrimitiveTag.CODE,
      PrimitiveTag.STRING,
      PrimitiveTag.INTEGER,
      PrimitiveTag.HEAP,
    ].includes(val & 0x7)
  );
}

/**
 * Utility: Extracts the primary tag from a tagged value.
 */
export function getTag(val: number): number {
  return fromTaggedValue(val).tag;
}

/**
 * Utility: Extracts the data portion (value) from a tagged value.
 */
export function getValue(val: number): number {
  return fromTaggedValue(val).value;
}

/**
 * Utility: Checks if a tagged value is ref-counted.
 *
 * In this design, we assume that only HEAP objects of the BLOCK subtype are ref-counted.
 */
export function isRefCounted(val: number): boolean {
  if (!isTaggedValue(val)) return false;
  const decoded = fromTaggedValue(val);
  return (
    decoded.tag === PrimitiveTag.HEAP &&
    decoded.heapSubtype === HeapSubType.BLOCK
  );
}

/**
 * Utility: Checks if a tagged value represents NIL.
 *
 * Here NIL is defined as an INTEGER with a value of 0.
 */
export function isNIL(val: number): boolean {
  if (!isTaggedValue(val)) return false;
  const decoded = fromTaggedValue(val);
  return decoded.tag === PrimitiveTag.INTEGER && decoded.value === 0;
}

/**
 * Utility: Custom number printing for debugging.
 *
 * If the number is a tagged value, it prints the tag and data.
 */
export function printNum(...args: unknown[]): void {
  const format = (num: number): string => {
    if (isTaggedValue(num)) {
      const { tag, value, heapSubtype } = fromTaggedValue(num);
      if (tag === PrimitiveTag.HEAP) {
        return `PrimitiveTag: ${tag} (HEAP, subtype: ${heapSubtype}), Value (address): ${value}`;
      } else {
        return `PrimitiveTag: ${tag}, Value: ${value}`;
      }
    } else {
      return num.toString();
    }
  };
  console.log(
    args.map((arg) => (typeof arg === "number" ? format(arg) : arg)).join(" ")
  );
}
