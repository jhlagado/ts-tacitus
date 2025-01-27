// src/string-buffer.test.ts
import { Memory } from "./memory";
import { StringBuffer } from "./string-buffer";
import { STRINGS, STRINGS_SIZE } from "./memory";

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
});
