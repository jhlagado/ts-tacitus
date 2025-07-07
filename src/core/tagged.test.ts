/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Tag,
  toTaggedValue,
  fromTaggedValue,
  getTag,
  getValue,
  isNIL,
} from './tagged';

describe('Tagged NaN Encoding', () => {
  it('should correctly decode encoded values', () => {
    const tests = [
      { tag: Tag.INTEGER, value: -32768 },
      { tag: Tag.INTEGER, value: 32767 },
      { tag: Tag.CODE, value: 12345 },
      { tag: Tag.STRING, value: 42 },
    ];
    tests.forEach(({ tag, value }) => {
      const encoded = toTaggedValue(value, tag);
      const decoded = fromTaggedValue(encoded);
      expect(decoded.tag).toBe(tag);
      expect(decoded.value).toBe(value);
    });
  });


  it('should throw on invalid tag ranges', () => {
    expect(() => toTaggedValue(0, 5 as any)).toThrow('Invalid tag: 5');
  });

  it('should validate value ranges for INTEGER', () => {
    expect(() => toTaggedValue(32768, Tag.INTEGER)).toThrow();
    expect(() => toTaggedValue(-32769, Tag.INTEGER)).toThrow();
  });

  it('should validate unsigned value ranges for non-INTEGER types', () => {
    expect(() => toTaggedValue(65536, Tag.STRING)).toThrow();
  });

  it('should correctly extract value for integer types', () => {
    const encodedNeg = toTaggedValue(-32768, Tag.INTEGER);
    const encodedPos = toTaggedValue(32767, Tag.INTEGER);
    const decodedNeg = fromTaggedValue(encodedNeg);
    const decodedPos = fromTaggedValue(encodedPos);

    expect(decodedNeg.value).toBe(-32768);
    expect(decodedPos.value).toBe(32767);
  });

  // Additional tests for the remaining exported functions:

  it('should return the correct tag using getTag', () => {
    const encoded = toTaggedValue(123, Tag.CODE);
    expect(getTag(encoded)).toBe(Tag.CODE);
  });

  it('should return the correct value using getValue', () => {
    const encoded = toTaggedValue(456, Tag.CODE);
    expect(getValue(encoded)).toBe(456);
  });

  it('should correctly identify NIL using isNIL', () => {
    // A NIL value is a tagged integer with value 0
    expect(isNIL(toTaggedValue(0, Tag.INTEGER))).toBe(true);
    // A non-NIL tagged value should return false
    const nonNil = toTaggedValue(1, Tag.INTEGER);
    expect(isNIL(nonNil)).toBe(false);
  });
});
