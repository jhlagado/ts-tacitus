import { Digest } from "./digest";
import { Memory } from "./memory";
import { STRINGS, STRINGS_SIZE } from "./memory";

describe("Digest", () => {
  let memory: Memory;
  let digest: Digest;

  beforeEach(() => {
    memory = new Memory();
    digest = new Digest(memory);
  });

  it("should add a string and return its starting address", () => {
    const address = digest.add("hello");
    expect(address).toBe(STRINGS);
    expect(digest.get(address)).toBe("hello");
  });

  it("should throw an error if the string is too long", () => {
    const longString = "a".repeat(256);
    expect(() => digest.add(longString)).toThrow(
      "String too long (max 255 characters)"
    );
  });

  it("should throw an error if there is not enough space in memory", () => {
    const smallString = "a".repeat(255);
    const numStrings = Math.floor(STRINGS_SIZE / (smallString.length + 1));
    for (let i = 0; i < numStrings; i++) {
      digest.add(smallString);
    }
    expect(() => digest.add("b")).toThrow("String digest overflow");
  });

  it("should reset the digest to its initial state", () => {
    digest.add("hello");
    digest.reset(STRINGS + 10);
    expect(digest.SBP).toBe(STRINGS + 10);
  });

  it("should throw an error when resetting to an invalid address", () => {
    expect(() => digest.reset(STRINGS - 1)).toThrow(
      "Invalid reset address"
    );
    expect(() => digest.reset(STRINGS + STRINGS_SIZE + 1)).toThrow(
      "Invalid reset address"
    );
  });

  it("should throw an error when reading from an invalid address", () => {
    expect(() => digest.get(STRINGS - 1)).toThrow(
      "Address is outside memory bounds"
    );
    expect(() => digest.get(STRINGS + STRINGS_SIZE + 1)).toThrow(
      "Address is outside memory bounds"
    );
  });

  it("should find an existing string and return its address", () => {
    const address1 = digest.add("hello");
    const address2 = digest.find("hello");
    expect(address2).toBe(address1);
  });

  it("should return NOT_FOUND for a non-existing string", () => {
    const address = digest.find("nonexistent");
    expect(address).toBe(-1);
  });

  it("should intern a string and return its address", () => {
    const address1 = digest.intern("hello");
    const address2 = digest.intern("hello");
    expect(address1).toBe(address2);
    expect(digest.get(address1)).toBe("hello");
  });

  it("should add a new string if not found during intern", () => {
    const address1 = digest.intern("hello");
    const address2 = digest.intern("world");
    expect(address1).not.toBe(address2);
    expect(digest.get(address1)).toBe("hello");
    expect(digest.get(address2)).toBe("world");
  });

  it("should correctly handle multiple strings", () => {
    const address1 = digest.add("hello");
    const address2 = digest.add("world");
    expect(address1).not.toBe(address2);
    expect(digest.get(address1)).toBe("hello");
    expect(digest.get(address2)).toBe("world");
  });

  it("should correctly handle empty strings", () => {
    const address = digest.add("");
    expect(digest.get(address)).toBe("");
  });

  it("should correctly handle strings with special characters", () => {
    const specialString = "hello\nworld\t!";
    const address = digest.add(specialString);
    expect(digest.get(address)).toBe(specialString);
  });

  it("should correctly handle strings with maximum length", () => {
    const maxLengthString = "a".repeat(255);
    const address = digest.add(maxLengthString);
    expect(digest.get(address)).toBe(maxLengthString);
  });

  // Additional tests to cover specific lines

  it("should handle adding multiple strings and retrieving them correctly", () => {
    const address1 = digest.add("first");
    const address2 = digest.add("second");
    const address3 = digest.add("third");
    expect(digest.get(address1)).toBe("first");
    expect(digest.get(address2)).toBe("second");
    expect(digest.get(address3)).toBe("third");
  });

  it("should handle resetting the digest and adding new strings", () => {
    digest.add("hello");
    digest.reset();
    const address = digest.add("new");
    expect(digest.get(address)).toBe("new");
  });

  it("should handle finding strings after multiple additions", () => {
    digest.add("first");
    digest.add("second");
    const address = digest.find("second");
    expect(address).not.toBe(-1);
    expect(digest.get(address)).toBe("second");
  });

  it("should handle interning strings after multiple additions", () => {
    digest.add("first");
    digest.add("second");
    const address1 = digest.intern("second");
    const address2 = digest.intern("second");
    expect(address1).toBe(address2);
    expect(digest.get(address1)).toBe("second");
  });
});
