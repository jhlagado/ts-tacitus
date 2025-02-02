import {
  toTagNum,
  fromTagNum,
  istagNum,
  getTag,
  getPointer,
  Tag,
  TAG_ANY,
} from "./tagnum";

describe("tagNum Library", () => {
  // Test all tag types
  for (const [type, tag] of Object.entries(Tag)) {
    it(`should encode and decode a ${type} tag and pointer`, () => {
      const pointer = type === "INTEGER" ? -12345 : 0x12345; // Use signed value for INTEGER tag
      const tagNum = toTagNum(tag, pointer);

      // Check if the value is a NaN
      expect(istagNum(tagNum)).toBe(true);

      // Decode the tagNum value
      const { tag: decodedTag, pointer: decodedPointer } = fromTagNum(
        TAG_ANY,
        tagNum
      );
      expect(decodedTag).toBe(tag);
      expect(decodedPointer).toBe(pointer);

      // Extract the tag and pointer directly
      expect(getTag(tagNum)).toBe(tag);
      expect(getPointer(tagNum)).toBe(pointer);
    });
  }

  it("should throw an error for invalid tags", () => {
    expect(() => toTagNum(0, 0x12345)).toThrow(
      "Tag must be a 3-bit value (1-7)"
    );
    expect(() => toTagNum(8, 0x12345)).toThrow(
      "Tag must be a 3-bit value (1-7)"
    );
  });

  it("should throw an error for invalid pointers", () => {
    expect(() => toTagNum(Tag.ADDRESS, -1)).toThrow(
      "Pointer must be a 20-bit value"
    );
    expect(() => toTagNum(Tag.ADDRESS, 0x100000)).toThrow(
      "Pointer must be a 20-bit value"
    );
    expect(() => toTagNum(Tag.INTEGER, -524289)).toThrow(
      "Pointer must be a 20-bit signed integer"
    );
    expect(() => toTagNum(Tag.INTEGER, 524288)).toThrow(
      "Pointer must be a 20-bit signed integer"
    );
  });

  it("should throw an error when decoding a non-NaN value", () => {
    expect(() => fromTagNum(TAG_ANY, 3.14)).toThrow(
      "Value is not a Tagged Pointer"
    );
  });

  it("should check if a value is an tagNum value", () => {
    const pointer = 0x9abcd; // 20-bit pointer
    const tagNum = toTagNum(Tag.ADDRESS, pointer);

    expect(istagNum(tagNum)).toBe(true);
    expect(istagNum(3.14)).toBe(false);
  });
});
