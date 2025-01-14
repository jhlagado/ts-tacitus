import { lex } from "./lexer";

describe("Lexer", () => {
  it("should tokenize a simple command", () => {
    const tokens = lex("5 3 +");
    expect(tokens).toEqual([5, 3, "+"]);
  });

  it("should handle comments", () => {
    const tokens = lex("# This is a comment\n5 3 +");
    expect(tokens).toEqual([5, 3, "+"]);
  });

  it("should parse numbers", () => {
    const tokens = lex("5 -3.14 42");
    expect(tokens).toEqual([5, -3.14, 42]);
  });

  it("should handle mixed input", () => {
    const tokens = lex("5 dup # Comment\n3.14 swap");
    expect(tokens).toEqual([5, "dup", 3.14, "swap"]);
  });

  it("should skip empty lines and spaces", () => {
    const tokens = lex("  \n5   \n3  +  ");
    expect(tokens).toEqual([5, 3, "+"]);
  });

  it("should handle empty input", () => {
    const tokens = lex("");
    expect(tokens).toEqual([]);
  });

  it("should handle lines with only comments", () => {
    const tokens = lex("# Comment 1\n# Comment 2\n# Comment 3");
    expect(tokens).toEqual([]);
  });

  it("should handle lines with inline comments", () => {
    const tokens = lex("5 3 + # This is an inline comment");
    expect(tokens).toEqual([5, 3, "+"]);
  });

  it("should handle multiple spaces and empty words", () => {
    const tokens = lex("5   3   +");
    expect(tokens).toEqual([5, 3, "+"]);
  });

  it("should handle invalid number formats", () => {
    const tokens = lex("5 invalid 3.14.15 +");
    expect(tokens).toEqual([5, "invalid", "3.14.15", "+"]);
  });

  it("should handle mixed input with numbers and words", () => {
    const tokens = lex("5 dup 3.14 swap -42.0 drop");
    expect(tokens).toEqual([5, "dup", 3.14, "swap", -42.0, "drop"]);
  });

  it("should handle negative numbers", () => {
    const tokens = lex("-5 -3.14 +");
    expect(tokens).toEqual([-5, -3.14, "+"]);
  });

  it("should handle floating-point numbers", () => {
    const tokens = lex("3.14 0.5 -2.0");
    expect(tokens).toEqual([3.14, 0.5, -2.0]);
  });

  it("should handle multiple lines with mixed content", () => {
    const tokens = lex("5 3 +\n# Comment\n10 20 -\nswap");
    expect(tokens).toEqual([5, 3, "+", 10, 20, "-", "swap"]);
  });

  // New test for line 28: Empty line after removing comments
  it("should skip lines that are empty after removing comments", () => {
    const tokens = lex("5 3 +\n# Comment\n\n10 20 -\n# Another comment\nswap");
    expect(tokens).toEqual([5, 3, "+", 10, 20, "-", "swap"]);
  });

  // New test for line 36: Empty words due to multiple spaces
  it("should skip empty words caused by multiple spaces", () => {
    const tokens = lex("5   3   +");
    expect(tokens).toEqual([5, 3, "+"]);
  });

  // Test for skipping empty lines
  it("should skip empty lines", () => {
    const tokens = lex("\n\n5 3 +\n\n");
    expect(tokens).toEqual([5, 3, "+"]);
  });

  // Test for skipping inline comments
  it("should skip inline comments", () => {
    const tokens = lex("5 3 + # This is a comment");
    expect(tokens).toEqual([5, 3, "+"]);
  });

  // Test for skipping lines with only comments
  it("should skip lines with only comments", () => {
    const tokens = lex("# Comment 1\n# Comment 2\n5 3 +");
    expect(tokens).toEqual([5, 3, "+"]);
  });
});
