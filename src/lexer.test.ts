import { lex } from "./lexer";

describe("Lexer", () => {
  // Test 1: Simple commands
  it("should tokenize a simple command", () => {
    const tokens = lex("5 3 +");
    expect(tokens).toEqual([5, 3, "+"]);
  });

  it("should tokenize a command with multiple operations", () => {
    const tokens = lex("5 3 + 2 *");
    expect(tokens).toEqual([5, 3, "+", 2, "*"]);
  });

  // Test 2: Numbers
  it("should tokenize positive integers", () => {
    const tokens = lex("42 100");
    expect(tokens).toEqual([42, 100]);
  });

  it("should tokenize negative integers", () => {
    const tokens = lex("-42 -100");
    expect(tokens).toEqual([-42, -100]);
  });

  it("should tokenize positive floats", () => {
    const tokens = lex("3.14 0.5");
    expect(tokens).toEqual([3.14, 0.5]);
  });

  it("should tokenize negative floats", () => {
    const tokens = lex("-3.14 -0.5");
    expect(tokens).toEqual([-3.14, -0.5]);
  });

  it("should tokenize explicit positive numbers", () => {
    const tokens = lex("+123 +0.5");
    expect(tokens).toEqual([123, 0.5]);
  });

  it("should handle numbers adjacent to non-number characters", () => {
    const tokens = lex("{-345}");
    expect(tokens).toEqual(["{", -345, "}"]);
  });

  // Test 3: Words
  it("should tokenize words like swap and drop", () => {
    const tokens = lex("swap drop");
    expect(tokens).toEqual(["swap", "drop"]);
  });

  it("should tokenize mixed input with numbers and words", () => {
    const tokens = lex("5 dup 3.14 swap");
    expect(tokens).toEqual([5, "dup", 3.14, "swap"]);
  });

  // Test 4: Special characters
  it("should tokenize special characters", () => {
    const tokens = lex("{ } ( ) + - * /");
    expect(tokens).toEqual(["{", "}", "(", ")", "+", "-", "*", "/"]);
  });

  it("should handle standalone operators", () => {
    const tokens = lex("5 + 3 - 2");
    expect(tokens).toEqual([5, "+", 3, "-", 2]);
  });

  // Test 5: Whitespace and comments
  it("should skip empty lines", () => {
    const tokens = lex("\n\n5 3 +\n\n");
    expect(tokens).toEqual([5, 3, "+"]);
  });

  it("should skip lines with only comments", () => {
    const tokens = lex("# Comment 1\n# Comment 2\n5 3 +");
    expect(tokens).toEqual([5, 3, "+"]);
  });

  it("should skip inline comments", () => {
    const tokens = lex("5 3 + # This is a comment");
    expect(tokens).toEqual([5, 3, "+"]);
  });

  it("should handle multiple spaces and empty words", () => {
    const tokens = lex("5   3   +");
    expect(tokens).toEqual([5, 3, "+"]);
  });

  it("should throw an error for invalid number formats", () => {
    expect(() => lex("5 invalid 3.14.15 +")).toThrow("Invalid number: 3.14.");
  });

  it("should handle mixed input with numbers, words, and special characters", () => {
    const tokens = lex("{-345} swap drop 42.5 +");
    expect(tokens).toEqual(["{", -345, "}", "swap", "drop", 42.5, "+"]);
  });

  it("should handle multiple lines with mixed content", () => {
    const tokens = lex("5 3 +\n# Comment\n10 20 -\nswap");
    expect(tokens).toEqual([5, 3, "+", 10, 20, "-", "swap"]);
  });

  it("should handle empty input", () => {
    const tokens = lex("");
    expect(tokens).toEqual([]);
  });

  // Test 7: Complex expressions
  it("should tokenize complex expressions", () => {
    const tokens = lex("5 dup { 3 + } drop");
    expect(tokens).toEqual([5, "dup", "{", 3, "+", "}", "drop"]);
  });

  it("should handle nested expressions", () => {
    const tokens = lex("{ { 5 } { 3 } + }");
    expect(tokens).toEqual(["{", "{", 5, "}", "{", 3, "}", "+", "}"]);
  });

  // Test 8: Edge cases for numbers
  it("should handle numbers with leading zeros", () => {
    const tokens = lex("007 00.5");
    expect(tokens).toEqual([7, 0.5]);
  });

  it("should handle numbers with trailing zeros", () => {
    const tokens = lex("5.00 100.0");
    expect(tokens).toEqual([5, 100]);
  });

  it("should handle numbers with no digits after decimal", () => {
    const tokens = lex("5. 100.");
    expect(tokens).toEqual([5, 100]);
  });

  // Test 9: Edge cases for words
  it("should handle words with mixed case", () => {
    const tokens = lex("Swap DROP");
    expect(tokens).toEqual(["Swap", "DROP"]);
  });

  it("should handle words with underscores", () => {
    const tokens = lex("my_word another_word");
    expect(tokens).toEqual(["my_word", "another_word"]);
  });

  // Test 10: Edge cases for special characters
  it("should handle multiple special characters in a row", () => {
    const tokens = lex("{{}}");
    expect(tokens).toEqual(["{", "{", "}", "}"]);
  });

  it("should handle special characters adjacent to numbers", () => {
    const tokens = lex("6 3 / 2 -");
    expect(tokens).toEqual([6,3, "/", 2, "-"]);
  });
});
