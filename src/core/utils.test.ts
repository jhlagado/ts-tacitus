// File: src/tests/utils.test.ts
import {
  isDigit,
  isWhitespace,
  isGroupingChar,
  toUnsigned16,
  toBoolean,
  toNumber,
  not,
  and,
  or,
  xor,
} from "./utils";

describe("Utils", () => {
  describe("isDigit", () => {
    it("should return true for digits", () => {
      expect(isDigit("0")).toBe(true);
      expect(isDigit("5")).toBe(true);
      expect(isDigit("9")).toBe(true);
    });

    it("should return false for non-digits", () => {
      expect(isDigit("a")).toBe(false);
      expect(isDigit(" ")).toBe(false);
      expect(isDigit("+")).toBe(false);
    });
  });

  describe("isWhitespace", () => {
    it("should return true for whitespace characters", () => {
      expect(isWhitespace(" ")).toBe(true);
      expect(isWhitespace("\t")).toBe(true);
      expect(isWhitespace("\n")).toBe(true);
      expect(isWhitespace("\r")).toBe(true);
    });

    it("should return false for non-whitespace characters", () => {
      expect(isWhitespace("a")).toBe(false);
      expect(isWhitespace("1")).toBe(false);
      expect(isWhitespace("+")).toBe(false);
    });
  });

  describe("isGroupingChar", () => {
    it("should return true for grouping characters", () => {
      // All the grouping characters: {}[]()"'`
      expect(isGroupingChar("{")).toBe(true);
      expect(isGroupingChar("}")).toBe(true);
      expect(isGroupingChar("[")).toBe(true);
      expect(isGroupingChar("]")).toBe(true);
      expect(isGroupingChar("(")).toBe(true);
      expect(isGroupingChar(")")).toBe(true);
      expect(isGroupingChar(`"`)).toBe(true);
      expect(isGroupingChar("'")).toBe(true);
      expect(isGroupingChar("`")).toBe(true);
    });

    it("should return false for characters that are not grouping chars", () => {
      expect(isGroupingChar("a")).toBe(false);
      expect(isGroupingChar("1")).toBe(false);
      expect(isGroupingChar(" ")).toBe(false);
      expect(isGroupingChar("+")).toBe(false);
    });
  });

  describe("toUnsigned16", () => {
    it("should convert positive numbers correctly", () => {
      expect(toUnsigned16(0)).toBe(0);
      expect(toUnsigned16(1)).toBe(1);
      expect(toUnsigned16(65535)).toBe(65535); // 0xFFFF
      expect(toUnsigned16(65536)).toBe(0); // 0x0000
      expect(toUnsigned16(123456)).toBe(57920); // 0xE240
    });

    it("should convert negative numbers correctly", () => {
      expect(toUnsigned16(-1)).toBe(65535); // 0xFFFF
      expect(toUnsigned16(-2)).toBe(65534); // 0xFFFE
      expect(toUnsigned16(-123456)).toBe(7616); // 0x1DC0
    });

    it("should handle large positive numbers", () => {
      expect(toUnsigned16(4294967295)).toBe(65535); // 0xFFFFFFFF -> 0xFFFF
      expect(toUnsigned16(4294967296)).toBe(0); // 0x100000000 -> 0x0000
    });

    it("should handle large negative numbers", () => {
      expect(toUnsigned16(-4294967295)).toBe(1); // 0xFFFFFFFF00000001 -> 0x0001
      expect(toUnsigned16(-4294967296)).toBe(0); // 0xFFFFFFFF00000000 -> 0x0000
    });
  });

  describe("toBoolean", () => {
    it("should return false for 0", () => {
      expect(toBoolean(0)).toBe(false);
    });
    it("should return true for non-zero numbers", () => {
      expect(toBoolean(1)).toBe(true);
      expect(toBoolean(-1)).toBe(true);
      expect(toBoolean(0.0001)).toBe(true);
    });
  });

  describe("toNumber", () => {
    it("should return 1 for true and 0 for false", () => {
      expect(toNumber(true)).toBe(1);
      expect(toNumber(false)).toBe(0);
    });
  });

  describe("not", () => {
    it("should return 0 for non-zero value", () => {
      expect(not(5)).toBe(0);
      expect(not(-1)).toBe(0);
    });
    it("should return 1 for zero", () => {
      expect(not(0)).toBe(1);
    });
  });

  describe("and", () => {
    it("should return 1 if both values are non-zero", () => {
      expect(and(5, 10)).toBe(1);
      expect(and(-1, 1)).toBe(1);
    });
    it("should return 0 if either value is zero", () => {
      expect(and(5, 0)).toBe(0);
      expect(and(0, 10)).toBe(0);
      expect(and(0, 0)).toBe(0);
    });
  });

  describe("or", () => {
    it("should return 1 if either value is non-zero", () => {
      expect(or(5, 0)).toBe(1);
      expect(or(0, 10)).toBe(1);
      expect(or(5, 10)).toBe(1);
    });
    it("should return 0 if both values are zero", () => {
      expect(or(0, 0)).toBe(0);
    });
  });

  describe("xor", () => {
    it("should return 1 if exactly one value is non-zero", () => {
      expect(xor(5, 0)).toBe(1);
      expect(xor(0, 10)).toBe(1);
    });
    it("should return 0 if both values are non-zero or both are zero", () => {
      expect(xor(5, 10)).toBe(0);
      expect(xor(0, 0)).toBe(0);
    });
  });
});
