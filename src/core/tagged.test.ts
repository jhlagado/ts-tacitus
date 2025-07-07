/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Tag,
  toTaggedValue,
  fromTaggedValue,
  getTag,
  getValue,
  isNIL,
  isCode,
  isCodeBlock,
  isAnyCode,
} from './tagged';

describe('Tagged NaN Encoding', () => {
  it('should correctly decode encoded values', () => {
    const tests = [
      { tag: Tag.INTEGER, value: -32768 },
      { tag: Tag.INTEGER, value: 32767 },
      { tag: Tag.CODE, value: 12345 },
      { tag: Tag.CODE_BLOCK, value: 54321 },
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
    const invalidTag = Tag.STACK_REF + 1; // Use a value beyond our highest defined tag
    expect(() => toTaggedValue(0, invalidTag as any)).toThrow(`Invalid tag: ${invalidTag}`);
  });

  it('should validate value ranges for INTEGER', () => {
    expect(() => toTaggedValue(32768, Tag.INTEGER)).toThrow();
    expect(() => toTaggedValue(-32769, Tag.INTEGER)).toThrow();
  });

  it('should validate unsigned value ranges for non-INTEGER types', () => {
    expect(() => toTaggedValue(-1, Tag.CODE)).toThrow();
    expect(() => toTaggedValue(65536, Tag.CODE)).toThrow();
    expect(() => toTaggedValue(-1, Tag.CODE_BLOCK)).toThrow();
    expect(() => toTaggedValue(65536, Tag.CODE_BLOCK)).toThrow();
    expect(() => toTaggedValue(-1, Tag.STRING)).toThrow();
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
    expect(isNIL(toTaggedValue(0, Tag.INTEGER))).toBe(true);
    expect(isNIL(toTaggedValue(1, Tag.INTEGER))).toBe(false);
  });

  it('should correctly identify code types', () => {
    const func = toTaggedValue(123, Tag.CODE);
    const block = toTaggedValue(456, Tag.CODE_BLOCK);
    const str = toTaggedValue(789, Tag.STRING);
    
    expect(isCode(func)).toBe(true);
    expect(isCode(block)).toBe(false);
    expect(isCode(str)).toBe(false);
    
    expect(isCodeBlock(func)).toBe(false);
    expect(isCodeBlock(block)).toBe(true);
    expect(isCodeBlock(str)).toBe(false);
    
    expect(isAnyCode(func)).toBe(true);
    expect(isAnyCode(block)).toBe(true);
    expect(isAnyCode(str)).toBe(false);
  });
});
