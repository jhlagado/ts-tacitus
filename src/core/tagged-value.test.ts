import {
  Tag,
  toTaggedValue,
  fromTaggedValue,
  isTaggedValue,
  getValue,
  isNIL,
  NIL,
} from "./tagged-value";

describe("Tagged NaN Encoding", () => {
  it("should encode/decode core tags", () => {
    const tests = [
      { tag: Tag.NIL, value: 0 },
      { tag: Tag.INTEGER, value: -32768 },
      { tag: Tag.CODE, value: 65535 },
      { tag: Tag.BLOCK, value: 42 },
    ];

    tests.forEach(({ tag, value }) => {
      const encoded = toTaggedValue(tag, value);
      const decoded = fromTaggedValue(tag, encoded);
      expect(decoded.tag).toBe(tag);
      expect(decoded.value).toBe(value);
    });
  });

  it("should handle extended tags", () => {
    const encoded = toTaggedValue(127, 12345);
    const decoded = fromTaggedValue(127, encoded);
    expect(decoded.tag).toBe(127);
    expect(decoded.value).toBe(12345);
  });

  it("should throw on invalid tags", () => {
    expect(() => toTaggedValue(-1, 0)).toThrow("7-bit");
    expect(() => toTaggedValue(128, 0)).toThrow("7-bit");
  });

  it("should validate value ranges", () => {
    expect(() => toTaggedValue(Tag.INTEGER, 32768)).toThrow();
    expect(() => toTaggedValue(Tag.SYMBOL, -1)).toThrow();
  });

  it("should handle NIL constant", () => {
    expect(isNIL(NIL)).toBe(true);
    expect(getValue(NIL)).toBe(0);
  });

  it("should detect tagged values", () => {
    expect(isTaggedValue(NIL)).toBe(true);
    expect(isTaggedValue(3.14)).toBe(false);
  });

  it("should handle tag mismatches", () => {
    const encoded = toTaggedValue(Tag.CODE, 123);
    expect(() => fromTaggedValue(Tag.BLOCK, encoded)).toThrow(`Tag mismatch: expected BLOCK, got CODE`);
  });

  // ... (other tests)

  it("should handle extended tags", () => {
    const maxTag = 127;
    const maxValue = 65535;

    const encoded = toTaggedValue(maxTag, maxValue);
    const decoded = fromTaggedValue(maxTag, encoded);

    expect(decoded.tag).toBe(maxTag);
    expect(decoded.value).toBe(maxValue);
  });

  it("should handle tag mismatches", () => {
    const encoded = toTaggedValue(Tag.CODE, 123);
    expect(() => fromTaggedValue(Tag.BLOCK, encoded)).toThrow("CODE");
  });
});
