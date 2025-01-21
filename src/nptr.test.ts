import { encodeNPtr, decodeNPtr, isNPtr, getTag, getPointer, TAGS } from "./nptr";

describe("NPtr Library", () => {
  // Test all tag types
  for (const [type, tag] of Object.entries(TAGS)) {
    it(`should encode and decode a ${type} tag and pointer`, () => {
      const pointer = type === "INTEGER" ? -12345 : 0x12345; // Use signed value for INTEGER tag
      const nPtr = encodeNPtr(tag, pointer);

      // Check if the value is a NaN
      expect(isNPtr(nPtr)).toBe(true);

      // Decode the NPtr value
      const { tag: decodedTag, pointer: decodedPointer } = decodeNPtr(nPtr);
      expect(decodedTag).toBe(tag);
      expect(decodedPointer).toBe(pointer);

      // Extract the tag and pointer directly
      expect(getTag(nPtr)).toBe(tag);
      expect(getPointer(nPtr)).toBe(pointer);
    });
  }

  it("should throw an error for invalid tags", () => {
    expect(() => encodeNPtr(0, 0x12345)).toThrow("Tag must be a 3-bit value (1-7)");
    expect(() => encodeNPtr(8, 0x12345)).toThrow("Tag must be a 3-bit value (1-7)");
  });

  it("should throw an error for invalid pointers", () => {
    expect(() => encodeNPtr(TAGS.ADDRESS, -1)).toThrow("Pointer must be a 20-bit value");
    expect(() => encodeNPtr(TAGS.ADDRESS, 0x100000)).toThrow("Pointer must be a 20-bit value");
    expect(() => encodeNPtr(TAGS.INTEGER, -524289)).toThrow("Pointer must be a 20-bit signed integer");
    expect(() => encodeNPtr(TAGS.INTEGER, 524288)).toThrow("Pointer must be a 20-bit signed integer");
  });

  it("should throw an error when decoding a non-NaN value", () => {
    expect(() => decodeNPtr(3.14)).toThrow("Value is not a NaN");
  });

  it("should check if a value is an NPtr value", () => {
    const pointer = 0x9ABCD; // 20-bit pointer
    const nPtr = encodeNPtr(TAGS.ADDRESS, pointer);

    expect(isNPtr(nPtr)).toBe(true);
    expect(isNPtr(3.14)).toBe(false);
  });
});