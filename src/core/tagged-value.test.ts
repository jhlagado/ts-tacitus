/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  NonHeapTag,
  HeapTag,
  toTaggedValue,
  fromTaggedValue,
  isTaggedValue,
  getValue,
  getTag,
  isNIL,
  NIL,
  isRefCounted,
  isHeapAllocated
} from "./tagged-value";

describe("Tagged NaN Encoding", () => {
  it("should encode/decode non-heap values", () => {
    const tests = [
      { tag: NonHeapTag.NIL, value: 0 },
      { tag: NonHeapTag.INTEGER, value: -32768 },
      { tag: NonHeapTag.INTEGER, value: 32767 },
      { tag: NonHeapTag.CODE, value: 12345 },
      { tag: NonHeapTag.NAN, value: 65535 },
      { tag: NonHeapTag.STRING, value: 42 },
    ];
    tests.forEach(({ tag, value }) => {
      const encoded = toTaggedValue(value, false, tag);
      const decoded = fromTaggedValue(encoded);
      expect(decoded.heap).toBe(false);
      expect(decoded.tag).toBe(tag);
      expect(decoded.value).toBe(value);
    });
  });

  it("should encode/decode heap values", () => {
    const tests = [
      { tag: HeapTag.BLOCK, value: 0 },
      { tag: HeapTag.SEQ, value: 1 },
      { tag: HeapTag.VECTOR, value: 32767 },
      { tag: HeapTag.DICT, value: 65535 },
    ];
    tests.forEach(({ tag, value }) => {
      const encoded = toTaggedValue(value, true, tag);
      const decoded = fromTaggedValue(encoded);
      expect(decoded.heap).toBe(true);
      expect(decoded.tag).toBe(tag);
      expect(decoded.value).toBe(value);
    });
  });

  it("should throw on invalid tag ranges", () => {
    expect(() => toTaggedValue(0, false, 5 as any)).toThrow("Invalid non-heap tag");
    expect(() => toTaggedValue(0, true, 4 as any)).toThrow("Invalid heap tag");
  });

  it("should validate value ranges for INTEGER", () => {
    expect(() => toTaggedValue(32768, false, NonHeapTag.INTEGER)).toThrow();
    expect(() => toTaggedValue(-32769, false, NonHeapTag.INTEGER)).toThrow();
  });

  it("should validate unsigned value ranges for non-INTEGER types", () => {
    expect(() => toTaggedValue(-1, false, NonHeapTag.NIL)).toThrow();
    expect(() => toTaggedValue(-1, true, HeapTag.BLOCK)).toThrow();
    expect(() => toTaggedValue(65536, false, NonHeapTag.STRING)).toThrow();
  });

  it("should handle NIL constant", () => {
    expect(isNIL(NIL)).toBe(true);
    expect(getValue(NIL)).toBe(0);
    expect(getTag(NIL)).toBe(NonHeapTag.NIL);
    expect(isHeapAllocated(NIL)).toBe(false);
  });

  it("should detect tagged values", () => {
    expect(isTaggedValue(NIL)).toBe(true);
    expect(isTaggedValue(3.14)).toBe(false);
    expect(isTaggedValue(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isTaggedValue(Number.NEGATIVE_INFINITY)).toBe(false);
  });

  it("should correctly identify heap-allocated values", () => {
    const encodedHeap = toTaggedValue(100, true, HeapTag.VECTOR);
    const encodedNonHeap = toTaggedValue(100, false, NonHeapTag.STRING);
    expect(isHeapAllocated(encodedHeap)).toBe(true);
    expect(isHeapAllocated(encodedNonHeap)).toBe(false);
  });

  it("should correctly identify reference-counted heap objects", () => {
    const blockEncoded = toTaggedValue(200, true, HeapTag.BLOCK);
    const dictEncoded = toTaggedValue(123, true, HeapTag.DICT);
    const nonHeapEncoded = toTaggedValue(50, false, NonHeapTag.STRING);
    
    expect(isRefCounted(blockEncoded)).toBe(true);
    expect(isRefCounted(dictEncoded)).toBe(true);
    expect(isRefCounted(nonHeapEncoded)).toBe(false);
  });

  it("should reject non-tagged values in fromTaggedValue", () => {
    expect(() => fromTaggedValue(3.14)).toThrow("Not a tagged value");
    expect(() => fromTaggedValue(Number.POSITIVE_INFINITY)).toThrow("Not a tagged value");
  });

  it("should correctly extract tag and heap flag", () => {
    const encoded = toTaggedValue(500, true, HeapTag.SEQ);
    const decoded = fromTaggedValue(encoded);
    expect(decoded.heap).toBe(true);
    expect(decoded.tag).toBe(HeapTag.SEQ);
    expect(decoded.value).toBe(500);
  });

  it("should correctly extract value for integer types", () => {
    const encodedNeg = toTaggedValue(-32768, false, NonHeapTag.INTEGER);
    const encodedPos = toTaggedValue(32767, false, NonHeapTag.INTEGER);
    const decodedNeg = fromTaggedValue(encodedNeg);
    const decodedPos = fromTaggedValue(encodedPos);
    
    expect(decodedNeg.value).toBe(-32768);
    expect(decodedPos.value).toBe(32767);
  });
});
