import {
  toTaggedPtr,
  fromTaggedPtr,
  isNPtr,
  getTag,
  getPointer,
  TAG,
} from "./tagged-ptr";

describe("NPtr Library", () => {
  // Test all tag types
  for (const [type, tag] of Object.entries(TAG)) {
    it(`should encode and decode a ${type} tag and pointer`, () => {
      const pointer = type === "INTEGER" ? -12345 : 0x12345; // Use signed value for INTEGER tag
      const nPtr = toTaggedPtr(tag, pointer);

      // Check if the value is a NaN
      expect(isNPtr(nPtr)).toBe(true);

      // Decode the NPtr value
      const { tag: decodedTag, pointer: decodedPointer } = fromTaggedPtr(nPtr);
      expect(decodedTag).toBe(tag);
      expect(decodedPointer).toBe(pointer);

      // Extract the tag and pointer directly
      expect(getTag(nPtr)).toBe(tag);
      expect(getPointer(nPtr)).toBe(pointer);
    });
  }

  it("should throw an error for invalid tags", () => {
    expect(() => toTaggedPtr(0, 0x12345)).toThrow(
      "Tag must be a 3-bit value (1-7)"
    );
    expect(() => toTaggedPtr(8, 0x12345)).toThrow(
      "Tag must be a 3-bit value (1-7)"
    );
  });

  it("should throw an error for invalid pointers", () => {
    expect(() => toTaggedPtr(TAG.ADDRESS, -1)).toThrow(
      "Pointer must be a 20-bit value"
    );
    expect(() => toTaggedPtr(TAG.ADDRESS, 0x100000)).toThrow(
      "Pointer must be a 20-bit value"
    );
    expect(() => toTaggedPtr(TAG.INTEGER, -524289)).toThrow(
      "Pointer must be a 20-bit signed integer"
    );
    expect(() => toTaggedPtr(TAG.INTEGER, 524288)).toThrow(
      "Pointer must be a 20-bit signed integer"
    );
  });

  it("should throw an error when decoding a non-NaN value", () => {
    expect(() => fromTaggedPtr(3.14)).toThrow("Value is not a NaN");
  });

  it("should check if a value is an NPtr value", () => {
    const pointer = 0x9abcd; // 20-bit pointer
    const nPtr = toTaggedPtr(TAG.ADDRESS, pointer);

    expect(isNPtr(nPtr)).toBe(true);
    expect(isNPtr(3.14)).toBe(false);
  });
});
