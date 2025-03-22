// Two separate enums: one for non–heap types and one for heap–allocated types.
export enum CoreTag {
  NIL = 0,
  INTEGER = 1,
  CODE = 2,
  NAN = 3,
  STRING = 4,
}

export enum HeapTag {
  BLOCK = 0,
  SEQ = 1,
  VECTOR = 2,
  DICT = 3,
}

export type Tag = CoreTag | HeapTag;

// Human–readable names for debugging.
export const nonHeapTagNames: { [key in CoreTag]: string } = {
  [CoreTag.NIL]: "NIL",
  [CoreTag.INTEGER]: "INTEGER",
  [CoreTag.CODE]: "CODE",
  [CoreTag.NAN]: "NAN",
  [CoreTag.STRING]: "STRING",
};

export const heapTagNames: { [key in HeapTag]: string } = {
  [HeapTag.BLOCK]: "BLOCK",
  [HeapTag.SEQ]: "SEQ",
  [HeapTag.VECTOR]: "VECTOR",
  [HeapTag.DICT]: "DICT",
};

// Constants for the NaN–boxing scheme.
const VALUE_BITS = 16;
const NAN_BIT = 1 << 22;
const SIGN_BIT = 1 << 31;
const TAG_MANTISSA_MASK = 0x3f << 16; // 6 bits available for the tag.
const VALUE_MASK = (1 << VALUE_BITS) - 1;
const EXPONENT_MASK = 0xff << 23;

// NIL constant: a non–heap tagged value with NonHeapTag.NIL and value 0.
export const NIL = toTaggedValue(0, false, CoreTag.INTEGER);

/**
 * Encodes a tagged value using NaN boxing.
 *
 * @param value - A 16–bit number. For NonHeapTag.INTEGER the value is signed; for all other tags it must be unsigned.
 * @param heap - Boolean flag. If true, the sign bit is set and the tag is interpreted as a HeapTag.
 * @param tag - A tag value. For heap === false, this must be in the range of NonHeapTag; for heap === true, in the range of HeapTag.
 *
 * @returns a number that is a NaN–boxed tagged value.
 */
export function toTaggedValue(value: number, heap: boolean, tag: Tag): number {
  // Validate the tag based on whether the value is heap–allocated.
  if (heap) {
    // Heap tags must be between HeapTag.BLOCK and HeapTag.DICT.
    if (tag < HeapTag.BLOCK || tag > HeapTag.DICT) {
      throw new Error("Invalid heap tag");
    }
  } else {
    // Non–heap tags must be between NonHeapTag.NIL and NonHeapTag.STRING.
    if (tag < CoreTag.NIL || tag > CoreTag.STRING) {
      throw new Error("Invalid non-heap tag");
    }
  }

  // Validate and encode the value.
  let encodedValue: number;
  if (!heap && tag === CoreTag.INTEGER) {
    if (value < -32768 || value > 32767) {
      throw new Error(
        "Value must be 16-bit signed integer (-32768 to 32767) for INTEGER tag"
      );
    }
    encodedValue = value & 0xffff;
  } else {
    if (value < 0 || value > 65535) {
      throw new Error("Value must be 16-bit unsigned integer (0 to 65535)");
    }
    encodedValue = value;
  }

  // Set the sign bit if heap allocated.
  const signBit = heap ? SIGN_BIT : 0;
  // Pack the 6-bit tag into bits 16–21.
  const mantissaTagBits = (tag & 0x3f) << 16;
  // Assemble the final 32-bit pattern.
  const bits =
    signBit | EXPONENT_MASK | NAN_BIT | mantissaTagBits | encodedValue;
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, bits, true);
  return view.getFloat32(0, true);
}

/**
 * Decodes a NaN–boxed tagged value.
 *
 * @param nanValue - The value to decode.
 * @returns An object with three properties:
 *   - value: The 16-bit number (sign–extended if NonHeapTag.INTEGER).
 *   - heap: Boolean indicating if the value is heap–allocated (if the sign bit is set).
 *   - tag: The tag value (should be interpreted as NonHeapTag if heap is false, or HeapTag if heap is true).
 */
export function fromTaggedValue(nanValue: number): {
  value: number;
  heap: boolean;
  tag: Tag;
} {
  if (!isTaggedValue(nanValue)) {
    throw new Error("Not a tagged value");
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
  const value =
    !heap && tagBits === CoreTag.INTEGER ? (valueBits << 16) >> 16 : valueBits;
  return { value, heap, tag: tagBits };
}

/**
 * Checks if a number is a NaN–boxed tagged value.
 */
export const isTaggedValue = isNaN;

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
 * Returns true if the tagged value is heap allocated.
 */
export function isHeapAllocated(value: number): boolean {
  if (!isTaggedValue(value)) return false;
  return fromTaggedValue(value).heap;
}

/**
 * Returns true if the tagged value represents NIL.
 */
export function isNIL(value: number): boolean {
  if (!isTaggedValue(value)) return false;
  const decoded = fromTaggedValue(value);
  return !decoded.heap && decoded.tag === CoreTag.NIL;
}

/**
 * Returns true if the tagged value represents a reference-counted heap object.
 */
export function isRefCounted(value: number): boolean {
  if (!isTaggedValue(value)) return false;
  return fromTaggedValue(value).heap;
}

/**
 * Prints a formatted representation of a tagged value.
 */
export function printNum(...args: unknown[]): void {
  const format = (num: number): string => {
    if (isTaggedValue(num)) {
      const { heap, tag, value } = fromTaggedValue(num);
      let tagName: string;
      if (heap) {
        tagName = heapTagNames[tag as HeapTag] || `HeapTag(${tag})`;
      } else {
        tagName = nonHeapTagNames[tag as CoreTag] || `NonHeapTag(${tag})`;
      }
      return `Heap: ${heap}, Tag: ${tag} (${tagName}), Value: ${value}`;
    } else {
      return num.toString();
    }
  };
  console.log(
    args
      .map((arg) => (typeof arg === "number" ? format(arg) : String(arg)))
      .join(" ")
  );
}
