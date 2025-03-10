// tagged.ts

/**
 * New tagging scheme:
 *
 * Primitives:
 *   FLOAT:   PrimitiveTag = 0         → 31 bits for float (assumed to have a 22-bit mantissa)
 *   CODE:    PrimitiveTag = 001       → 29 bits for address (4-byte alignment)
 *   STRING:  PrimitiveTag = 011       → 29 bits for address (4-byte alignment)
 *   INTEGER: PrimitiveTag = 101       → 29 bits for signed integer (0 used for NIL)
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
  FLOAT = 0, // 000 in binary
  CODE = 1, // 001 in binary (LSB set to 1)
  STRING = 3, // 011 in binary (LSB set to 1)
  INTEGER = 5, // 101 in binary (LSB set to 1)
  HEAP = 7, // 111 in binary (LSB set to 1)
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
      // Store the float in a buffer to get its raw bits
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      view.setFloat32(0, value, true); // Store value as 32-bit float

      let raw = view.getUint32(0, true); // Get raw 32-bit representation
      raw &= 0xfffffffe; // Clear LSB for tagging

      // Return the modified bit representation directly
      encoded = raw;
      break;

    case PrimitiveTag.CODE:
    case PrimitiveTag.STRING:
    case PrimitiveTag.INTEGER:
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
      // Encode: shift left 3 bits and OR in the tag.
      encoded = (value << 3) | tag;
      break;

    case PrimitiveTag.HEAP:
      if (heapSubtype === undefined) {
        throw new Error("Heap subtype must be provided for HEAP tagged values");
      }
      if ((value & 0x3f) !== 0) {
        throw new Error(
          "Heap address must be 64-byte aligned (lower 6 bits zero)"
        );
      }
      // Mask out the lower 6 bits directly.
      encoded = value & ~0x3f;
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
  // **Step 1: Detect FLOAT (LSB = 0)**
  if ((encoded & 0x1) === 0) {
    // Convert raw bits back to a 32-bit float
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, encoded, true);
    const value = view.getFloat32(0, true);
    return { tag: PrimitiveTag.FLOAT, value };
  }

  // **Step 2: Extract the tag from the lower three bits (only for non-FLOAT values)**
  const tag = encoded & 0x7;

  // Check expected tag, if provided.
  if (expectedTag !== undefined && tag !== expectedTag) {
    throw new Error(
      `PrimitiveTag mismatch: expected ${expectedTag}, got ${tag}`
    );
  }

  let value: number;
  let heapSubtype: HeapSubType | undefined;

  switch (tag) {
    case PrimitiveTag.CODE:
    case PrimitiveTag.STRING:
      // For CODE and STRING, extract the upper 29-bit address.
      value = (encoded & ~0x7) >>> 3;
      break;
    case PrimitiveTag.INTEGER:
      // For INTEGER, extract the upper 29-bit signed value.
      value = (encoded & ~0x7) >> 3;
      break;
    case PrimitiveTag.HEAP:
      // Extract the heap subtype (bits 3-5).
      heapSubtype = (encoded >> 3) & 0x7;

      if (
        expectedHeapSubtype !== undefined &&
        heapSubtype !== expectedHeapSubtype
      ) {
        throw new Error(
          `Heap Subtype mismatch: expected ${expectedHeapSubtype}, got ${heapSubtype}`
        );
      }

      // Extract the heap address (shift right 6 to remove subtype and tag bits).
      value = (encoded >> 6) << 6;
      break;
    default:
      throw new Error(`Unsupported tag in encoded value: ${tag}`);
  }

  return { tag, value, heapSubtype };
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
  const decoded = fromTaggedValue(val);
  return (
    decoded.tag === PrimitiveTag.HEAP &&
    decoded.heapSubtype === HeapSubType.BLOCK
  );
}
