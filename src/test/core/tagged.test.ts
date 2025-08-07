/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Tag,
  toTaggedValue,
  fromTaggedValue,
  getTag,
  getValue,
  isNIL,
  isCode,
  isAnyCode,
  isRList,
  MAX_TAG,
} from '../../core/tagged';
describe('Tagged NaN Encoding', () => {
  test('should correctly decode encoded values', () => {
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

  test('should throw on invalid tag ranges', () => {
    const invalidTag = MAX_TAG + 1;
    expect(() => toTaggedValue(0, invalidTag as any)).toThrow(`Invalid tag: ${invalidTag}`);
  });
  test('should validate value ranges for INTEGER', () => {
    expect(() => toTaggedValue(32768, Tag.INTEGER)).toThrow();
    expect(() => toTaggedValue(-32769, Tag.INTEGER)).toThrow();
  });
  test('should validate unsigned value ranges for non-INTEGER types', () => {
    expect(() => toTaggedValue(-1, Tag.CODE)).toThrow();
    expect(() => toTaggedValue(65536, Tag.CODE)).toThrow();
    expect(() => toTaggedValue(-1, Tag.STRING)).toThrow();
    expect(() => toTaggedValue(65536, Tag.STRING)).toThrow();
  });
  test('should correctly extract value for integer types', () => {
    const encodedNeg = toTaggedValue(-32768, Tag.INTEGER);
    const encodedPos = toTaggedValue(32767, Tag.INTEGER);
    const decodedNeg = fromTaggedValue(encodedNeg);
    const decodedPos = fromTaggedValue(encodedPos);
    expect(decodedNeg.value).toBe(-32768);
    expect(decodedPos.value).toBe(32767);
  });

  test('should return the correct tag using getTag', () => {
    const encoded = toTaggedValue(123, Tag.CODE);
    expect(getTag(encoded)).toBe(Tag.CODE);
  });
  test('should return the correct value using getValue', () => {
    const encoded = toTaggedValue(456, Tag.CODE);
    expect(getValue(encoded)).toBe(456);
  });
  test('should correctly identify NIL using isNIL', () => {
    expect(isNIL(toTaggedValue(0, Tag.INTEGER))).toBe(true);
    expect(isNIL(toTaggedValue(1, Tag.INTEGER))).toBe(false);
  });
  test('should correctly identify code types', () => {
    const func = toTaggedValue(123, Tag.CODE);
    const str = toTaggedValue(789, Tag.STRING);
    expect(isCode(func)).toBe(true);
    expect(isCode(str)).toBe(false);
    expect(isAnyCode(func)).toBe(true);
    expect(isAnyCode(str)).toBe(false);
  });

  test('should correctly identify RLIST types', () => {
    const rlist = toTaggedValue(5, Tag.RLIST);
    const list = toTaggedValue(5, Tag.LIST);
    const integer = toTaggedValue(5, Tag.INTEGER);
    
    expect(isRList(rlist)).toBe(true);
    expect(isRList(list)).toBe(false);
    expect(isRList(integer)).toBe(false);
  });

  test('should handle RLIST with zero slot count', () => {
    const emptyRList = toTaggedValue(0, Tag.RLIST);
    expect(isRList(emptyRList)).toBe(true);
    
    const decoded = fromTaggedValue(emptyRList);
    expect(decoded.tag).toBe(Tag.RLIST);
    expect(decoded.value).toBe(0);
  });

  test('should handle RLIST with maximum slot count', () => {
    const maxRList = toTaggedValue(65535, Tag.RLIST);
    expect(isRList(maxRList)).toBe(true);
    
    const decoded = fromTaggedValue(maxRList);
    expect(decoded.tag).toBe(Tag.RLIST);
    expect(decoded.value).toBe(65535);
  });

  test('should validate RLIST value ranges', () => {
    expect(() => toTaggedValue(-1, Tag.RLIST)).toThrow();
    expect(() => toTaggedValue(65536, Tag.RLIST)).toThrow();
  });

  test('should include RLIST in encoded/decoded round-trip tests', () => {
    const tests = [
      { tag: Tag.RLIST, value: 0 },
      { tag: Tag.RLIST, value: 1 },
      { tag: Tag.RLIST, value: 65535 },
    ];

    tests.forEach(({ tag, value }) => {
      const encoded = toTaggedValue(value, tag);
      const decoded = fromTaggedValue(encoded);
      expect(decoded.tag).toBe(tag);
      expect(decoded.value).toBe(value);
      expect(isRList(encoded)).toBe(true);
    });
  });
});
