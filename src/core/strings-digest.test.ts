import { Memory } from "./memory";
import { STRINGS, STRINGS_SIZE } from "./memory";
import { StringDigest } from "./string-digest";

describe("StringDigest", () => {
  let memory: Memory;
  let stringDigest: StringDigest;

  beforeEach(() => {
    memory = new Memory();
    stringDigest = new StringDigest(memory);
  });

  it("should add a string and return its starting address", () => {
    const address = stringDigest.add("hello");
    expect(address).toBe(STRINGS);
    expect(stringDigest.get(address)).toBe("hello");
  });

  it("should throw an error if the string is too long", () => {
    const longString = "a".repeat(256);
    expect(() => stringDigest.add(longString)).toThrow(
      "String too long (max 255 characters)"
    );
  });

  it("should throw an error if there is not enough space in memory", () => {
    const smallString = "a".repeat(255);
    const numStrings = Math.floor(STRINGS_SIZE / (smallString.length + 1));
    for (let i = 0; i < numStrings; i++) {
      stringDigest.add(smallString);
    }
    expect(() => stringDigest.add("b")).toThrow("String digest overflow");
  });

  it("should reset the digest to its initial state", () => {
    stringDigest.add("hello");
    stringDigest.reset(STRINGS + 10);
    expect(stringDigest.SBP).toBe(STRINGS + 10);
  });

  it("should throw an error when resetting to an invalid address", () => {
    expect(() => stringDigest.reset(STRINGS - 1)).toThrow(
      "Invalid reset address"
    );
    expect(() => stringDigest.reset(STRINGS + STRINGS_SIZE + 1)).toThrow(
      "Invalid reset address"
    );
  });

  it("should throw an error when reading from an invalid address", () => {
    expect(() => stringDigest.get(STRINGS - 1)).toThrow(
      "Address is outside memory bounds"
    );
    expect(() => stringDigest.get(STRINGS + STRINGS_SIZE + 1)).toThrow(
      "Address is outside memory bounds"
    );
  });

  it("should find an existing string and return its address", () => {
    const address1 = stringDigest.add("hello");
    const address2 = stringDigest.find("hello");
    expect(address2).toBe(address1);
  });

  it("should return NOT_FOUND for a non-existing string", () => {
    const address = stringDigest.find("nonexistent");
    expect(address).toBe(-1);
  });

  it("should intern a string and return its address", () => {
    const address1 = stringDigest.intern("hello");
    const address2 = stringDigest.intern("hello");
    expect(address1).toBe(address2);
    expect(stringDigest.get(address1)).toBe("hello");
  });

  it("should add a new string if not found during intern", () => {
    const address1 = stringDigest.intern("hello");
    const address2 = stringDigest.intern("world");
    expect(address1).not.toBe(address2);
    expect(stringDigest.get(address1)).toBe("hello");
    expect(stringDigest.get(address2)).toBe("world");
  });

  it("should correctly handle multiple strings", () => {
    const address1 = stringDigest.add("hello");
    const address2 = stringDigest.add("world");
    expect(address1).not.toBe(address2);
    expect(stringDigest.get(address1)).toBe("hello");
    expect(stringDigest.get(address2)).toBe("world");
  });

  it("should correctly handle empty strings", () => {
    const address = stringDigest.add("");
    expect(stringDigest.get(address)).toBe("");
  });

  it("should correctly handle strings with special characters", () => {
    const specialString = "hello\nworld\t!";
    const address = stringDigest.add(specialString);
    expect(stringDigest.get(address)).toBe(specialString);
  });

  it("should correctly handle strings with maximum length", () => {
    const maxLengthString = "a".repeat(255);
    const address = stringDigest.add(maxLengthString);
    expect(stringDigest.get(address)).toBe(maxLengthString);
  });

  // Additional tests to cover specific lines

  it("should handle adding multiple strings and retrieving them correctly", () => {
    const address1 = stringDigest.add("first");
    const address2 = stringDigest.add("second");
    const address3 = stringDigest.add("third");
    expect(stringDigest.get(address1)).toBe("first");
    expect(stringDigest.get(address2)).toBe("second");
    expect(stringDigest.get(address3)).toBe("third");
  });

  it("should handle resetting the digest and adding new strings", () => {
    stringDigest.add("hello");
    stringDigest.reset();
    const address = stringDigest.add("new");
    expect(stringDigest.get(address)).toBe("new");
  });

  it("should handle finding strings after multiple additions", () => {
    stringDigest.add("first");
    stringDigest.add("second");
    const address = stringDigest.find("second");
    expect(address).not.toBe(-1);
    expect(stringDigest.get(address)).toBe("second");
  });

  it("should handle interning strings after multiple additions", () => {
    stringDigest.add("first");
    stringDigest.add("second");
    const address1 = stringDigest.intern("second");
    const address2 = stringDigest.intern("second");
    expect(address1).toBe(address2);
    expect(stringDigest.get(address1)).toBe("second");
  });
});
