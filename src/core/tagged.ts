/**
 * @file src/core/tagged.ts
 * NaN-boxing implementation for tagged values in 32-bit floats.
 */
export enum Tag {
  NUMBER = 0,

  SENTINEL = 1,

  CODE = 2,

  REF = 3,

  STRING = 4,

  LOCAL = 6,

  BUILTIN = 7,

  LIST = 8,
}

export const MAX_TAG = Tag.LIST;

export const tagNames: { [key in Tag]: string } = {
  [Tag.NUMBER]: 'NUMBER',
  [Tag.SENTINEL]: 'SENTINEL',
  [Tag.CODE]: 'CODE',
  [Tag.REF]: 'STACK_REF',
  [Tag.STRING]: 'STRING',
  [Tag.LOCAL]: 'LOCAL',
  [Tag.BUILTIN]: 'BUILTIN',
  [Tag.LIST]: 'LIST',
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

export const NIL = toTaggedValue(0, Tag.SENTINEL);

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
 * @deprecated Always returns false.
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
 * Checks if a value is a LIST.
 * @param tval The value to check
 * @returns true if the value is a LIST
 */
export function isList(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.LIST;
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

/**
 * Checks if a value is a STACK_REF.
 * @param tval The value to check
 * @returns true if the value is a STACK_REF
 */
export function isStackRef(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.REF;
}

/**
 * Creates a STACK_REF for a stack cell.
 * @param cellIndex The cell index (0-65535)
 * @returns Tagged STACK_REF value
 */
export function createStackRef(cellIndex: number): number {
  if (cellIndex < 0 || cellIndex > 65535) {
    throw new Error('Stack cell index must be 0-65535');
  }
  return toTaggedValue(cellIndex, Tag.REF);
}

/**
 * Gets byte address from a STACK_REF.
 * @param stackRef The STACK_REF value
 * @returns Byte address
 */
export function getStackRefAddress(stackRef: number): number {
  if (getTag(stackRef) !== Tag.REF) {
    throw new Error('Value is not a STACK_REF');
  }
  return getValue(stackRef) * 4;
}

