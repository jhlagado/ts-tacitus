/**
 * @file src/core/tagged.ts
 * NaN-boxing implementation for tagged values in 32-bit floats.
 */
export enum Tag {
  NUMBER = 0,

  SENTINEL = 1,

  CODE = 2,

  STRING = 4,

  LOCAL = 6,

  BUILTIN = 7,

  LIST = 8,
  STACK_REF = 9,
  RSTACK_REF = 10,
  GLOBAL_REF = 11,
  DATA_REF = 12,
}

export const MAX_TAG = Tag.DATA_REF;

/**
 * Enumerates the canonical sentinel payload values carried by `Tag.SENTINEL`.
 * Extend this enum when new sentinel literals are introduced at the language level.
 */
export enum Sentinel {
  NIL = 0,
  DEFAULT = 1,
}

export const tagNames: { [key in Tag]: string } = {
  [Tag.NUMBER]: 'NUMBER',
  [Tag.SENTINEL]: 'SENTINEL',
  [Tag.CODE]: 'CODE',
  [Tag.STRING]: 'STRING',
  [Tag.LOCAL]: 'LOCAL',
  [Tag.BUILTIN]: 'BUILTIN',
  [Tag.LIST]: 'LIST',
  [Tag.STACK_REF]: 'STACK_REF',
  [Tag.RSTACK_REF]: 'RSTACK_REF',
  [Tag.GLOBAL_REF]: 'GLOBAL_REF',
  [Tag.DATA_REF]: 'DATA_REF',
};

const VALUE_BITS = 16;
const NAN_BIT = 1 << 22;
const TAG_MANTISSA_MASK = 0x7f << 16;
const VALUE_MASK = (1 << VALUE_BITS) - 1;

const EXPONENT_MASK = 0xff << 23;

/**
 * Encodes a value and tag into a NaN-boxed 32-bit float.
 * @param value The value to encode
 * @param tag The tag type
 * @param meta Optional meta bit (0 or 1)
 * @returns NaN-boxed tagged value
 * @throws {Error} If parameters are invalid
 */
export function toTaggedValue(value: number, tag: Tag, meta = 0): number {
  if (tag < Tag.NUMBER || tag > MAX_TAG) {
    throw new Error(`Invalid tag: ${tag}`);
  }

  if (meta !== 0 && meta !== 1) {
    throw new Error(`Meta bit must be 0 or 1, got: ${meta}`);
  }

  if (tag === Tag.NUMBER) {
    if (meta !== 0) {
      throw new Error('Meta bit must be 0 for NUMBER tag (stored as raw IEEE 754)');
    }
    return value;
  }

  let encodedValue: number;
  if (tag === Tag.SENTINEL) {
    if (value < -32768 || value > 32767) {
      throw new Error('Value must be 16-bit signed integer (-32768 to 32767) for SENTINEL tag');
    }

    encodedValue = value & 0xffff;
  } else {
    if (value < 0 || value > 65535) {
      throw new Error('Value must be 16-bit unsigned integer (0 to 65535)');
    }

    encodedValue = value;
  }

  const mantissaTagBits = (tag & 0x3f) << 16;
  const signBit = meta ? 1 << 31 : 0;
  const bits = signBit | EXPONENT_MASK | NAN_BIT | mantissaTagBits | encodedValue;
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, bits, true);
  return view.getFloat32(0, true);
}

export const NIL = toTaggedValue(Sentinel.NIL, Tag.SENTINEL);

/**
 * Decodes a NaN-boxed value into components.
 * @param nanValue The NaN-boxed value
 * @returns Object with value, tag, and meta components
 */
export function fromTaggedValue(nanValue: number): { value: number; tag: Tag; meta: number } {
  if (!isNaN(nanValue)) {
    return { value: nanValue, tag: Tag.NUMBER, meta: 0 };
  }

  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, nanValue, true);
  const bits = view.getUint32(0, true);
  const meta = (bits >>> 31) & 1;
  const tagBits = ((bits & TAG_MANTISSA_MASK) >>> 16) & 0x3f;
  const valueBits = bits & VALUE_MASK;
  const value = tagBits === Tag.SENTINEL ? (valueBits << 16) >> 16 : valueBits;
  return { value, tag: tagBits, meta };
}

/**
 * Extracts the tag from a NaN-boxed value.
 * @param nanValue The NaN-boxed value
 * @returns The tag enum value
 */
export function getTag(nanValue: number): number {
  return fromTaggedValue(nanValue).tag;
}

/**
 * Extracts the value from a NaN-boxed value.
 * @param nanValue The NaN-boxed value
 * @returns The decoded numerical value
 */
export function getValue(nanValue: number): number {
  return fromTaggedValue(nanValue).value;
}

/**
 * Checks if a value represents NIL.
 * @param tval The value to check
 * @returns true if the value is NIL
 */
export function isNIL(tval: number): boolean {
  const { tag, value } = fromTaggedValue(tval);
  return tag === Tag.SENTINEL && value === 0;
}

/**
 * Unused helper. Always returns false.
 */
export function isRefCounted(_value: number): boolean {
  return false;
}

/**
 * Checks if a value is a NUMBER.
 * @param tval The value to check
 * @returns true if the value is a NUMBER
 */
export function isNumber(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.NUMBER;
}

/**
 * Checks if a value is a SENTINEL.
 * @param tval The value to check
 * @returns true if the value is a SENTINEL
 */
export function isSentinel(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.SENTINEL;
}

/**
 * Creates a RSTACK_REF tagged value.
 * @param slot The local variable slot number to reference
 * @returns A RSTACK_REF tagged value
 */
export function createLocalRef(slot: number): number {
  return toTaggedValue(slot, Tag.RSTACK_REF);
}

// Global references are not yet supported.

/**
 * Checks if a value is CODE.
 * @param tval The value to check
 * @returns true if the value is CODE
 */
export function isCode(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.CODE;
}

/**
 * Checks if a value is a STRING.
 * @param tval The value to check
 * @returns true if the value is a STRING
 */
export function isString(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.STRING;
}

/**
 * Checks if a value is a LOCAL.
 * @param tval The value to check
 * @returns true if the value is a LOCAL
 */
export function isLocal(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.LOCAL;
}

// Stack reference helpers are provided via core/refs.
