import {
  toTaggedValue,
  fromTaggedValue,
  isTaggedValue,
  getTag,
  getValue,
  Tag,
  TAG_ANY,
  tagNames,
} from "./tagged-value";

describe("tagNum Library", () => {
  // Test all tag types
  for (const [tag, type] of Object.entries(tagNames)) {
    it(`should encode and decode a ${type} tag and pointer`, () => {
      const pointer = type === "INTEGER" ? -12345 : 0x12345; // Use signed value for INTEGER tag
      const tagNum = toTaggedValue(Number(tag) as Tag, pointer);
      
      // Check if the value is a NaN
      expect(isTaggedValue(tagNum)).toBe(true);
      
      // Decode the tagNum value
      const { tag: decodedTag, value: decodedPointer } = fromTaggedValue(
        TAG_ANY,
        tagNum
      );
      console.log('encode:', tag, type, decodedTag);
      expect(decodedTag).toBe(Number(tag));
      expect(decodedPointer).toBe(pointer);

      // Extract the tag and pointer directly
      expect(getTag(tagNum)).toBe(Number(tag));
      expect(getValue(tagNum)).toBe(pointer);
    });
  }

  it("should throw an error for invalid tags", () => {
    expect(() => toTaggedValue(16 as Tag, 0x12345)).toThrow(
      "Tag must be a 4-bit value (0-15)"
    );
  });

  it("should throw an error for invalid pointers", () => {
    expect(() => toTaggedValue(Tag.CODE, -1)).toThrow(
      "Pointer must be a 19-bit value (0-524287)"
    );
    expect(() => toTaggedValue(Tag.CODE, 0x80000)).toThrow( // 0x80000 is 524288
      "Pointer must be a 19-bit value (0-524287)"
    );
    expect(() => toTaggedValue(Tag.INTEGER, -262145)).toThrow(
      "Pointer must be a 19-bit signed integer (-262144 to 262143)"
    );
    expect(() => toTaggedValue(Tag.INTEGER, 262144)).toThrow(
      "Pointer must be a 19-bit signed integer (-262144 to 262143)"
    );
  });

  it("should throw an error when decoding a non-NaN value", () => {
    expect(() => fromTaggedValue(TAG_ANY, 3.14)).toThrow(
      "Value is not a Tagged Pointer"
    );
  });

  it("should check if a value is an tagNum value", () => {
    const value = 0x1abcd; // 20-bit pointer
    const tagNum = toTaggedValue(Tag.CODE, value);

    expect(isTaggedValue(tagNum)).toBe(true);
    expect(isTaggedValue(3.14)).toBe(false);
  });
});