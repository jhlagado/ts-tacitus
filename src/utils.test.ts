import { isDigit, isLetter, isWhitespace, isSymbol } from "./utils";

describe("Utils", () => {
  // Test 1: isDigit
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

  // Test 2: isLetter
  describe("isLetter", () => {
    it("should return true for letters", () => {
      expect(isLetter("a")).toBe(true);
      expect(isLetter("Z")).toBe(true);
      expect(isLetter("m")).toBe(true);
    });

    it("should return false for non-letters", () => {
      expect(isLetter("1")).toBe(false);
      expect(isLetter(" ")).toBe(false);
      expect(isLetter("@")).toBe(false);
    });
  });

  // Test 3: isWhitespace
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

  // Test 4: isSymbol
  describe("isSymbol", () => {
    it("should return true for symbols", () => {
      expect(isSymbol("+")).toBe(true);
      expect(isSymbol("@")).toBe(true);
      expect(isSymbol("{")).toBe(true);
      expect(isSymbol("~")).toBe(true);
    });

    it("should return false for non-symbols", () => {
      expect(isSymbol("a")).toBe(false);
      expect(isSymbol("1")).toBe(false);
      expect(isSymbol(" ")).toBe(false);
    });
  });
});
