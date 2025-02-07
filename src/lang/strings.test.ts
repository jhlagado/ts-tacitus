import { Memory } from "../memory";
import { StringBuffer } from "./strings";
import { STRINGS, STRINGS_SIZE } from "../memory";

describe("StringBuffer", () => {
  let memory: Memory;
  let stringBuffer: StringBuffer;

  beforeEach(() => {
    memory = new Memory();
    stringBuffer = new StringBuffer(memory);
  });

  it("should add a string and return its starting address", () => {
    const address = stringBuffer.add("hello");
    expect(address).toBe(STRINGS);
    expect(stringBuffer.get(address)).toBe("hello");
  });

  it("should throw an error if the string is too long", () => {
    const longString = "a".repeat(256);
    expect(() => stringBuffer.add(longString)).toThrow(
      "String too long (max 255 characters)"
    );
  });

  it("should throw an error if there is not enough space in memory", () => {
    const smallString = "a".repeat(255);
    const numStrings = Math.floor(STRINGS_SIZE / (smallString.length + 1));
    for (let i = 0; i < numStrings; i++) {
      stringBuffer.add(smallString);
    }
    expect(() => stringBuffer.add("b")).toThrow("String buffer overflow");
  });

  it("should reset the buffer to its initial state", () => {
    stringBuffer.add("hello");
    stringBuffer.reset(STRINGS + 10);
    expect(stringBuffer.SBP).toBe(STRINGS + 10);
  });

  it("should throw an error when resetting to an invalid address", () => {
    expect(() => stringBuffer.reset(STRINGS - 1)).toThrow(
      "Invalid reset address"
    );
    expect(() => stringBuffer.reset(STRINGS + STRINGS_SIZE + 1)).toThrow(
      "Invalid reset address"
    );
  });

  it("should throw an error when reading from an invalid address", () => {
    expect(() => stringBuffer.get(STRINGS - 1)).toThrow(
      "Address is outside memory bounds"
    );
    expect(() => stringBuffer.get(STRINGS + STRINGS_SIZE + 1)).toThrow(
      "Address is outside memory bounds"
    );
  });

  it("should find an existing string and return its address", () => {
    const address1 = stringBuffer.add("hello");
    const address2 = stringBuffer.find("hello");
    expect(address2).toBe(address1);
  });

  it("should return NOT_FOUND for a non-existing string", () => {
    const address = stringBuffer.find("nonexistent");
    expect(address).toBe(-1);
  });

  it("should intern a string and return its address", () => {
    const address1 = stringBuffer.intern("hello");
    const address2 = stringBuffer.intern("hello");
    expect(address1).toBe(address2);
    expect(stringBuffer.get(address1)).toBe("hello");
  });

  it("should add a new string if not found during intern", () => {
    const address1 = stringBuffer.intern("hello");
    const address2 = stringBuffer.intern("world");
    expect(address1).not.toBe(address2);
    expect(stringBuffer.get(address1)).toBe("hello");
    expect(stringBuffer.get(address2)).toBe("world");
  });

  it("should correctly handle multiple strings", () => {
    const address1 = stringBuffer.add("hello");
    const address2 = stringBuffer.add("world");
    expect(address1).not.toBe(address2);
    expect(stringBuffer.get(address1)).toBe("hello");
    expect(stringBuffer.get(address2)).toBe("world");
  });

  it("should correctly handle empty strings", () => {
    const address = stringBuffer.add("");
    expect(stringBuffer.get(address)).toBe("");
  });

  it("should correctly handle strings with special characters", () => {
    const specialString = "hello\nworld\t!";
    const address = stringBuffer.add(specialString);
    expect(stringBuffer.get(address)).toBe(specialString);
  });

  it("should correctly handle strings with maximum length", () => {
    const maxLengthString = "a".repeat(255);
    const address = stringBuffer.add(maxLengthString);
    expect(stringBuffer.get(address)).toBe(maxLengthString);
  });

  // Additional tests to cover specific lines

  it("should handle adding multiple strings and retrieving them correctly", () => {
    const address1 = stringBuffer.add("first");
    const address2 = stringBuffer.add("second");
    const address3 = stringBuffer.add("third");
    expect(stringBuffer.get(address1)).toBe("first");
    expect(stringBuffer.get(address2)).toBe("second");
    expect(stringBuffer.get(address3)).toBe("third");
  });

  it("should handle resetting the buffer and adding new strings", () => {
    stringBuffer.add("hello");
    stringBuffer.reset();
    const address = stringBuffer.add("new");
    expect(stringBuffer.get(address)).toBe("new");
  });

  it("should handle finding strings after multiple additions", () => {
    stringBuffer.add("first");
    stringBuffer.add("second");
    const address = stringBuffer.find("second");
    expect(address).not.toBe(-1);
    expect(stringBuffer.get(address)).toBe("second");
  });

  it("should handle interning strings after multiple additions", () => {
    stringBuffer.add("first");
    stringBuffer.add("second");
    const address1 = stringBuffer.intern("second");
    const address2 = stringBuffer.intern("second");
    expect(address1).toBe(address2);
    expect(stringBuffer.get(address1)).toBe("second");
  });
});
