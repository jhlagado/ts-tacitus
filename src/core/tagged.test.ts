/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CoreTag,
  toTaggedValue,
  fromTaggedValue,
  getTag,
  getValue,
  isNIL,
  NIL,
  isInteger,
  isNumber,
  isCode,
  isString,
} from './tagged';

describe('Tagged NaN Encoding', () => {
  it('should encode/decode non-heap values', () => {
    const tests = [
      { tag: CoreTag.INTEGER, value: -32768 },
      { tag: CoreTag.INTEGER, value: 32767 },
      { tag: CoreTag.CODE, value: 12345 },
      { tag: CoreTag.STRING, value: 42 },
    ];
    tests.forEach(({ tag, value }) => {
      const encoded = toTaggedValue(value, false, tag);
      const decoded = fromTaggedValue(encoded);
      expect(decoded.isHeap).toBe(false);
      expect(decoded.tag).toBe(tag);
      expect(decoded.value).toBe(value);
    });
  });

  // Note: Heap types have been removed from the tagged.ts implementation

  it('should throw on invalid tag ranges', () => {
    expect(() => toTaggedValue(0, false, 5 as any)).toThrow('Invalid tag');
  });

  it('should validate value ranges for INTEGER', () => {
    expect(() => toTaggedValue(32768, false, CoreTag.INTEGER)).toThrow();
    expect(() => toTaggedValue(-32769, false, CoreTag.INTEGER)).toThrow();
  });

  it('should validate unsigned value ranges for non-INTEGER types', () => {
    expect(() => toTaggedValue(-1, false, CoreTag.STRING)).toThrow();
    expect(() => toTaggedValue(65536, false, CoreTag.STRING)).toThrow();
  });

  // Note: Heap types have been removed from the tagged.ts implementation

  // Note: Reference counting has been removed from the tagged.ts implementation

  it('should correctly extract tag', () => {
    const encoded = toTaggedValue(500, false, CoreTag.STRING);
    const decoded = fromTaggedValue(encoded);
    expect(decoded.isHeap).toBe(false);
    expect(decoded.tag).toBe(CoreTag.STRING);
    expect(decoded.value).toBe(500);
  });

  it('should correctly extract value for integer types', () => {
    const encodedNeg = toTaggedValue(-32768, false, CoreTag.INTEGER);
    const encodedPos = toTaggedValue(32767, false, CoreTag.INTEGER);
    const decodedNeg = fromTaggedValue(encodedNeg);
    const decodedPos = fromTaggedValue(encodedPos);

    expect(decodedNeg.value).toBe(-32768);
    expect(decodedPos.value).toBe(32767);
  });

  // Additional tests for the remaining exported functions:

  it('should return the correct tag using getTag', () => {
    const encoded = toTaggedValue(123, false, CoreTag.CODE);
    expect(getTag(encoded)).toBe(CoreTag.CODE);
  });

  it('should return the correct value using getValue', () => {
    const encoded = toTaggedValue(456, false, CoreTag.STRING);
    expect(getValue(encoded)).toBe(456);
  });

  it('should correctly identify NIL using isNIL', () => {
    // Create a NIL value using the NIL constant
    expect(isNIL(NIL)).toBe(true);
    // A non-NIL tagged value should return false.
    const nonNil = toTaggedValue(1, false, CoreTag.INTEGER);
    expect(isNIL(nonNil)).toBe(false);
  });

  it('should correctly identify types using helper functions', () => {
    const numValue = 3.14159;
    const intValue = toTaggedValue(42, false, CoreTag.INTEGER);
    const codeValue = toTaggedValue(100, false, CoreTag.CODE);
    const strValue = toTaggedValue(200, false, CoreTag.STRING);
    
    // Test isNumber
    expect(isNumber(numValue)).toBe(true);
    expect(isNumber(intValue)).toBe(false);
    
    // Test isInteger
    expect(isInteger(intValue)).toBe(true);
    expect(isInteger(numValue)).toBe(false);
    
    // Test isCode
    expect(isCode(codeValue)).toBe(true);
    expect(isCode(intValue)).toBe(false);
    
    // Test isString
    expect(isString(strValue)).toBe(true);
    expect(isString(intValue)).toBe(false);
  });
});
