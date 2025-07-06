/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CoreTag,
  HeapTag,
  toTaggedValue,
  fromTaggedValue,
  getTag,
  getValue,
  isHeapAllocated,
  isRefCounted,
  isNIL,
  NIL,
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

  it('should encode/decode heap values', () => {
    const tests = [
      { tag: HeapTag.BLOCK, value: 0 },
      { tag: HeapTag.SEQUENCE, value: 1 },
      { tag: HeapTag.VECTOR, value: 32767 },
    ];
    tests.forEach(({ tag, value }) => {
      const encoded = toTaggedValue(value, true, tag);
      const decoded = fromTaggedValue(encoded);
      expect(decoded.isHeap).toBe(true);
      expect(decoded.tag).toBe(tag);
      expect(decoded.value).toBe(value);
    });
  });

  it('should throw on invalid tag ranges', () => {
    expect(() => toTaggedValue(0, false, 5 as any)).toThrow('Invalid non-heap tag');
    expect(() => toTaggedValue(0, true, 4 as any)).toThrow('Invalid heap tag');
  });

  it('should validate value ranges for INTEGER', () => {
    expect(() => toTaggedValue(32768, false, CoreTag.INTEGER)).toThrow();
    expect(() => toTaggedValue(-32769, false, CoreTag.INTEGER)).toThrow();
  });

  it('should validate unsigned value ranges for non-INTEGER types', () => {
    expect(() => toTaggedValue(-1, true, HeapTag.BLOCK)).toThrow();
    expect(() => toTaggedValue(65536, false, CoreTag.STRING)).toThrow();
  });

  it('should correctly identify heap-allocated values', () => {
    const encodedHeap = toTaggedValue(100, true, HeapTag.VECTOR);
    const encodedNonHeap = toTaggedValue(100, false, CoreTag.STRING);
    expect(isHeapAllocated(encodedHeap)).toBe(true);
    expect(isHeapAllocated(encodedNonHeap)).toBe(false);
  });

  it('should correctly identify reference-counted heap objects', () => {
    const blockEncoded = toTaggedValue(200, true, HeapTag.BLOCK);
    const nonHeapEncoded = toTaggedValue(50, false, CoreTag.STRING);

    expect(isRefCounted(blockEncoded)).toBe(true);
    expect(isRefCounted(nonHeapEncoded)).toBe(false);
  });

  it('should correctly extract tag and heap flag', () => {
    const encoded = toTaggedValue(500, true, HeapTag.SEQUENCE);
    const decoded = fromTaggedValue(encoded);
    expect(decoded.isHeap).toBe(true);
    expect(decoded.tag).toBe(HeapTag.SEQUENCE);
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
    const encoded = toTaggedValue(456, true, HeapTag.SEQUENCE);
    expect(getValue(encoded)).toBe(456);
  });

  it('should correctly identify NIL using isNIL', () => {
    // Create a NIL value using the NIL constant
    expect(isNIL(NIL)).toBe(true);
    // A non-NIL tagged value should return false.
    const nonNil = toTaggedValue(1, false, CoreTag.INTEGER);
    expect(isNIL(nonNil)).toBe(false);
  });
});
