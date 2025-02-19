export enum Tag {
  NAN = 3,
  NIL = 0,
  INTEGER = 1,
  CODE = 2,
  SYMBOL = 4,
  BLOCK = 5,
}

export const tagNames: { [key in number]: string } = {
  [Tag.NAN]: "NAN",
  [Tag.NIL]: "NIL",
  [Tag.INTEGER]: "INTEGER",
  [Tag.CODE]: "CODE",
  [Tag.SYMBOL]: "SYMBOL",
  [Tag.BLOCK]: "BLOCK",
};

// Constants
const VALUE_BITS = 16;
const NAN_BIT = 1 << 22;
const SIGN_BIT = 1 << 31;
const TAG_MANTISSA_MASK = 0x3f << 16;
const VALUE_MASK = (1 << VALUE_BITS) - 1;
const EXPONENT_MASK = 0xff << 23;

export const TAG_ANY = 0;
export const NIL = toTaggedValue(Tag.NIL, 0);

export function toTaggedValue(tag: number, value: number): number {
  if (tag < 0 || tag > 127) {
    throw new Error("Tag must be 7-bit (0-127)");
  }

  const signBit = (tag & 0x40) ? SIGN_BIT : 0;
  const mantissaTagBits = (tag & 0x3f) << 16;

  let encodedValue: number;
  if (tag === Tag.INTEGER) {
    if (value < -32768 || value > 32767) {
      throw new Error("Value must be 16-bit signed integer (-32768 to 32767)");
    }
    encodedValue = value & 0xffff;
  } else {
    if (value < 0 || value > 65535) {
      throw new Error("Value must be 16-bit unsigned integer (0-65535)");
    }
    encodedValue = value;
  }

  const bits = signBit | EXPONENT_MASK | NAN_BIT | mantissaTagBits | encodedValue;
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setUint32(0, bits, true);
  return new DataView(buffer).getFloat32(0, true);
}

export function fromTaggedValue(
  expectedTag: number,
  nanValue: number
): { tag: number; value: number } {
  if (!isNaN(nanValue)) throw new Error("Not a tagged value");

  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, nanValue, true);
  const bits = view.getUint32(0, true);

  // Fixed sign bit calculation (shift 25 instead of 24)
  const signBit = (bits & SIGN_BIT) >>> 25; // Now gives 0x40 (64) if set
  const mantissaBits = (bits & TAG_MANTISSA_MASK) >>> 16;
  const tag = signBit | mantissaBits;

  const value = bits & VALUE_MASK;

  if (expectedTag !== TAG_ANY && expectedTag !== tag) {
    const expectedName = tagNames[expectedTag] || `TAG_${expectedTag}`;
    const actualName = tagNames[tag] || `TAG_${tag}`;
    throw new Error(`Tag mismatch: expected ${expectedName}, got ${actualName}`);
  }

  return {
    tag,
    value: tag === Tag.INTEGER ? (value << 16) >> 16 : value
  };
}

export const isTaggedValue = isNaN;

export function getTag(tagNum: number): number {
  return fromTaggedValue(TAG_ANY, tagNum).tag;
}

export function getValue(tagNum: number): number {
  return fromTaggedValue(TAG_ANY, tagNum).value;
}

export function isRefCounted(tagNum: number): boolean {
  return isTaggedValue(tagNum) && getTag(tagNum) === Tag.BLOCK;
}

export function isNIL(tagNum: number): boolean {
  return isTaggedValue(tagNum) && getTag(tagNum) === Tag.NIL;
}
