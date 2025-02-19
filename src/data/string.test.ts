// File: src/tests/string.test.ts

import { Memory } from "../core/memory";
import { Digest } from "../core/digest";
import { stringCreate } from "../data/string";
import { Tag, fromTaggedValue } from "../core/tagged-value";

describe("stringCreate", () => {
  let memory: Memory;
  let digest: Digest;

  beforeEach(() => {
    memory = new Memory();
    digest = new Digest(memory);
  });

  it("should create a tagged string with Tag.STRING", () => {
    const value = "hello";
    const taggedValue = stringCreate(digest, value);
    const { tag, value: address } = fromTaggedValue(Tag.STRING, taggedValue);
    expect(tag).toBe(Tag.STRING);
    expect(digest.get(address)).toBe(value);
  });

  it("should create distinct tagged strings for multiple calls", () => {
    const str1 = "foo";
    const str2 = "bar";
    const tagged1 = stringCreate(digest, str1);
    const tagged2 = stringCreate(digest, str2);
    const { value: address1 } = fromTaggedValue(Tag.STRING, tagged1);
    const { value: address2 } = fromTaggedValue(Tag.STRING, tagged2);
    expect(address1).not.toBe(address2);
    expect(digest.get(address1)).toBe(str1);
    expect(digest.get(address2)).toBe(str2);
  });

  it("should handle empty strings correctly", () => {
    const value = "";
    const taggedValue = stringCreate(digest, value);
    const { value: address } = fromTaggedValue(Tag.STRING, taggedValue);
    expect(digest.get(address)).toBe(value);
  });

  it("should throw an error if the string exceeds maximum length", () => {
    const longString = "a".repeat(256);
    expect(() => stringCreate(digest, longString)).toThrow(
      "String too long (max 255 characters)"
    );
  });

  it("should correctly store multiple strings in sequence", () => {
    const strings = ["first", "second", "third"];
    const taggedValues = strings.map((s) => stringCreate(digest, s));
    taggedValues.forEach((tagged, index) => {
      const { value: address } = fromTaggedValue(Tag.STRING, tagged);
      expect(digest.get(address)).toBe(strings[index]);
    });
  });
});
