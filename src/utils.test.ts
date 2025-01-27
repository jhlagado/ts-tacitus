import { isDigit, isWhitespace } from "./utils";

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
