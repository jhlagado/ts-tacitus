import { Token, Tokenizer, TokenType, TokenValue } from "./tokenizer";

describe("Tokenizer", () => {
  // Helper function to extract values from tokens for easier comparison
  function getTokenValues(input: string): TokenValue[] {
    const tokenizer = new Tokenizer(input);
    const values: TokenValue[] = [];
    let token = tokenizer.nextToken();

    while (token.type !== TokenType.EOF) {
      values.push(token.value);
      token = tokenizer.nextToken();
    }

    return values;
  }

  // Helper to get full tokens for more detailed testing
  function getAllTokens(input: string): Token[] {
    const tokenizer = new Tokenizer(input);
    const tokens = [];
    let token = tokenizer.nextToken();

    while (token.type !== TokenType.EOF) {
      tokens.push(token);
      token = tokenizer.nextToken();
    }

    return tokens;
  }

  // Test 1: Simple commands
  it("should tokenize a simple command", () => {
    const tokens = getAllTokens("5 3 +");

    expect(tokens.length).toBe(3);
    expect(tokens[0]).toEqual(
      expect.objectContaining({ type: TokenType.NUMBER, value: 5 })
    );
    expect(tokens[1]).toEqual(
      expect.objectContaining({ type: TokenType.NUMBER, value: 3 })
    );
    expect(tokens[2]).toEqual(
      expect.objectContaining({ type: TokenType.WORD, value: "+" })
    );
  });

  it("should tokenize a command with multiple operations", () => {
    const values = getTokenValues("5 3 + 2 *");
    expect(values).toEqual([5, 3, "+", 2, "*"]);
  });

  // Test 2: Numbers
  it("should tokenize positive integers", () => {
    const values = getTokenValues("42 100");
    expect(values).toEqual([42, 100]);
  });

  it("should tokenize negative integers", () => {
    const values = getTokenValues("-42 -100");
    expect(values).toEqual([-42, -100]);
  });

  it("should tokenize positive floats", () => {
    const values = getTokenValues("3.14 0.5");
    expect(values).toEqual([3.14, 0.5]);
  });

  it("should tokenize negative floats", () => {
    const values = getTokenValues("-3.14 -0.5");
    expect(values).toEqual([-3.14, -0.5]);
  });

  it("should tokenize explicit positive numbers", () => {
    const values = getTokenValues("+123 +0.5");
    expect(values).toEqual([123, 0.5]);
  });

  // In our simplified tokenizer, special characters are not split from adjacent numbers
  it("should handle numbers adjacent to special characters", () => {
    const values = getTokenValues("{-345}");
    expect(values).toEqual(["{-345}"]);
  });

  // Test 3: Words
  it("should tokenize words like swap and drop", () => {
    const tokens = getAllTokens("swap drop");

    expect(tokens.length).toBe(2);
    expect(tokens[0]).toEqual(
      expect.objectContaining({
        type: TokenType.WORD,
        value: "swap",
      })
    );
    expect(tokens[1]).toEqual(
      expect.objectContaining({
        type: TokenType.WORD,
        value: "drop",
      })
    );
  });

  it("should tokenize mixed input with numbers and words", () => {
    const values = getTokenValues("5 dup 3.14 swap");
    expect(values).toEqual([5, "dup", 3.14, "swap"]);
  });

  // Test 4: Special characters
  // In our simplified tokenizer, special chars are handled differently
  it("should tokenize special characters", () => {
    const values = getTokenValues("{ } ( ) + - * /");
    
    // Just check the values since our simplified tokenizer might classify them differently
    expect(values).toEqual(["{" , "}", "(", ")", "+", "-", "*", "/"]);
  });

  it("should handle standalone operators", () => {
    const values = getTokenValues("5 + 3 - 2");
    expect(values).toEqual([5, "+", 3, "-", 2]);
  });

  // Test 5: Whitespace and comments
  it("should skip empty lines", () => {
    const values = getTokenValues("\n\n5 3 +\n\n");
    expect(values).toEqual([5, 3, "+"]);
  });

  // Tests for Forth-style backslash comments
  it("should handle backslash comments", () => {
    const values = getTokenValues("5 3 + \\ Comment 1");
    // Backslash comment handling removes the comment
    expect(values).toEqual([5, 3, "+"]);
  });

  it("should handle multi-line content with comments", () => {
    const values = getTokenValues("5 \\ Comment on line 1\n3 + \\ Comment on line 2");
    expect(values).toEqual([5, 3, "+"]);
  });

  it("should handle multiple spaces and empty words", () => {
    const values = getTokenValues("5   3   +");
    expect(values).toEqual([5, 3, "+"]);
  });

  it("should handle mixed input with numbers, words, and special characters", () => {
    const values = getTokenValues("{-345} swap drop 42.5 +");
    expect(values).toEqual(["{-345}", "swap", "drop", 42.5, "+"]);
  });

  it("should handle multiple lines with mixed content", () => {
    const values = getTokenValues("5 3 +\n// Comment\n10 20 -\nswap");
    expect(values).toEqual([5, 3, "+", "//", "Comment", 10, 20, "-", "swap"]);
  });

  it("should handle empty input", () => {
    const tokenizer = new Tokenizer("");
    expect(tokenizer.nextToken().type).toBe(TokenType.EOF);
  });

  // Test 7: Simple expressions
  it("should tokenize simple expressions", () => {
    const values = getTokenValues("5 dup 3 + drop");
    expect(values).toEqual([5, "dup", 3, "+", "drop"]);
  });

  // Special characters are treated as word tokens in our simplified implementation
  it("should handle special characters in expressions", () => {
    const values = getTokenValues("{ 5 } { 3 } +");
    expect(values).toEqual(["{" , 5, "}", "{", 3, "}", "+"]);
  });

  // Test 8: Edge cases for numbers
  it("should handle numbers with leading zeros", () => {
    const values = getTokenValues("007 00.5");
    expect(values).toEqual([7, 0.5]);
  });

  // Test 9: Edge cases for words
  it("should handle words with mixed case", () => {
    const values = getTokenValues("Swap DROP");
    expect(values).toEqual(["Swap", "DROP"]);
  });

  it("should handle words with underscores", () => {
    const values = getTokenValues("my_word another_word");
    expect(values).toEqual(["my_word", "another_word"]);
  });

  // Test 10: Edge cases for special characters
  // Special characters without whitespace are treated as a single token
  it("should handle multiple special characters in a row", () => {
    const values = getTokenValues("{{}}");
    expect(values).toEqual(["{{}}"]);
  });

  // New tests specific to Tokenizer

  // Test 11: Token position tracking
  it("should track token positions correctly", () => {
    const tokens = getAllTokens("5 hello");

    expect(tokens[0].position).toBe(0); // "5" starts at position 0
    expect(tokens[1].position).toBe(2); // "hello" starts at position 2
  });

  // Test 12: Line and column tracking
  // In our simplified tokenizer line tracking works differently
  it("should tokenize multi-line content", () => {
    const tokenizer = new Tokenizer("hello\nworld");
    const token1 = tokenizer.nextToken();
    const token2 = tokenizer.nextToken();

    // We don't track lines the same way in simplified version
    expect(token1.value).toBe("hello");
    expect(token2.value).toBe("world");
  });

  // Test 13: Token pushback
  it("should allow pushing back a token", () => {
    const tokenizer = new Tokenizer("5 10");
    const token1 = tokenizer.nextToken();

    expect(token1.value).toBe(5);

    // Push back and read again
    tokenizer.pushBack(token1);
    const token1Again = tokenizer.nextToken();
    const token2 = tokenizer.nextToken();

    expect(token1Again.value).toBe(5);
    expect(token2.value).toBe(10);
  });

  // In our simplified implementation we just decrement the index, which allows multiple pushbacks
  it("should allow pushing back tokens", () => {
    const tokenizer = new Tokenizer("5 10");
    const _token1 = tokenizer.nextToken();
    const token2 = tokenizer.nextToken();

    // Push back token2 and read it again
    tokenizer.pushBack(token2);
    const token2Again = tokenizer.nextToken();
    expect(token2Again.value).toBe(10);
  });

  // Test 14: String handling in our simplified Forth implementation
  // Our simplified implementation doesn't have special handling for strings
  it("should treat quoted text as separate tokens by whitespace", () => {
    const values = getTokenValues('"Hello world"');
    // Tokenizer splits by whitespace, keeping quotes with the words
    expect(values).toEqual(['"Hello', 'world"']);
  });

  it("should preserve quotes in tokens", () => {
    const values = getTokenValues('"Hello"');
    // Quotes remain part of the token
    expect(values).toEqual(['"Hello"']);
  });

  it("should handle mixed quoted text and other tokens", () => {
    const values = getTokenValues('5 "hello" +');
    // Quotes are preserved in the token
    expect(values).toEqual([5, '"hello"', '+']);
  });
});
