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
      const smallString = "a".repeat(255); // Maximum length for a single string
      const numStrings = Math.floor(STRINGS_SIZE / (smallString.length + 1)); // Number of strings that fit in memory

      // Add strings until memory is exhausted
      for (let i = 0; i < numStrings; i++) {
        stringBuffer.add(smallString);
      }

      // Adding one more string should cause an overflow
      expect(() => stringBuffer.add("b")).toThrow("String buffer overflow");
    });

    it("should get a string from its starting address", () => {
      const address = stringBuffer.add("hello");
      expect(stringBuffer.get(address)).toBe("hello");
    });

    it("should return the remaining space in memory", () => {
      stringBuffer.add("hello");
      expect(stringBuffer.remainingSpace).toBe(STRINGS_SIZE - 6); // 1 byte for length + 5 bytes for "hello"
    });
  });

  describe("edge cases", () => {
    it("should handle maximum length string", () => {
      const maxString = "a".repeat(255);
      const addr = stringBuffer.add(maxString);
      expect(stringBuffer.get(addr)).toBe(maxString);
    });
  });
});
