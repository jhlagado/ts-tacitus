import { isDigit, isWhitespace, toUnsigned16 } from "./utils";

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
