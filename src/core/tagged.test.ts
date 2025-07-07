/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Tag,
  toTaggedValue,
  fromTaggedValue,
  getTag,
  getValue,
  isNIL,
  NIL,
} from './tagged';

describe('Tagged NaN Encoding', () => {
  it('should encode/decode non-heap values', () => {
    const tests = [
      { tag: Tag.INTEGER, value: -32768 },
      { tag: Tag.INTEGER, value: 32767 },
      { tag: Tag.CODE, value: 12345 },
      { tag: Tag.STRING, value: 42 },
    ];
    tests.forEach(({ tag, value }) => {
      const encoded = toTaggedValue(value, false, tag);
      const decoded = fromTaggedValue(encoded);
      expect(decoded.isHeap).toBe(false);
      expect(decoded.tag).toBe(tag);
      expect(decoded.value).toBe(value);
    });
  });


  it('should throw on invalid tag ranges', () => {
    expect(() => toTaggedValue(0, false, 5 as any)).toThrow('Invalid tag: 5');
    expect(() => toTaggedValue(0, true, 4 as any)).toThrow('Heap-allocated values are not supported');
  });

  it('should validate value ranges for INTEGER', () => {
    expect(() => toTaggedValue(32768, false, Tag.INTEGER)).toThrow();
    expect(() => toTaggedValue(-32769, false, Tag.INTEGER)).toThrow();
  });

  it('should validate unsigned value ranges for non-INTEGER types', () => {
    expect(() => toTaggedValue(65536, false, Tag.STRING)).toThrow();
  });

  it('should correctly extract value for integer types', () => {
    const encodedNeg = toTaggedValue(-32768, false, Tag.INTEGER);
    const encodedPos = toTaggedValue(32767, false, Tag.INTEGER);
    const decodedNeg = fromTaggedValue(encodedNeg);
    const decodedPos = fromTaggedValue(encodedPos);

    expect(decodedNeg.value).toBe(-32768);
    expect(decodedPos.value).toBe(32767);
  });

  // Additional tests for the remaining exported functions:

  it('should return the correct tag using getTag', () => {
    const encoded = toTaggedValue(123, false, Tag.CODE);
    expect(getTag(encoded)).toBe(Tag.CODE);
  });

  it('should return the correct value using getValue', () => {
    const encoded = toTaggedValue(456, false, Tag.CODE);
    expect(getValue(encoded)).toBe(456);
  });

  it('should correctly identify NIL using isNIL', () => {
    // Create a NIL value using the NIL constant
    expect(isNIL(NIL)).toBe(true);
    // A non-NIL tagged value should return false.
    const nonNil = toTaggedValue(1, false, Tag.INTEGER);
    expect(isNIL(nonNil)).toBe(false);
  });
});
