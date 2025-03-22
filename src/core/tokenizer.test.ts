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

  it("should handle numbers adjacent to special characters", () => {
    const values = getTokenValues("{-345}");
    expect(values).toEqual(["{", -345, "}"]);
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
  it("should tokenize special characters", () => {
    const tokens = getAllTokens("{ } ( ) + - * /");

    expect(tokens.length).toBe(8);
    expect(tokens[0].type).toBe(TokenType.WORD);
    expect(tokens[0].value).toBe("{");
    expect(tokens[1].type).toBe(TokenType.WORD);
    expect(tokens[1].value).toBe("}");
    expect(tokens[2].type).toBe(TokenType.SPECIAL);
    expect(tokens[2].value).toBe("(");
    expect(tokens[3].type).toBe(TokenType.SPECIAL);
    expect(tokens[3].value).toBe(")");
    // The rest are words since they're not grouping chars
    expect(tokens[4].type).toBe(TokenType.WORD);
    expect(tokens[4].value).toBe("+");
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

  it("should skip lines with only comments", () => {
    const values = getTokenValues("// Comment 1\n// Comment 2\n5 3 +");
    expect(values).toEqual([5, 3, "+"]);
  });

  it("should skip inline comments", () => {
    const values = getTokenValues("5 3 + // This is a comment");
    expect(values).toEqual([5, 3, "+"]);
  });

  it("should handle multiple spaces and empty words", () => {
    const values = getTokenValues("5   3   +");
    expect(values).toEqual([5, 3, "+"]);
  });

  it("should handle mixed input with numbers, words, and special characters", () => {
    const values = getTokenValues("{-345} swap drop 42.5 +");
    expect(values).toEqual(["{", -345, "}", "swap", "drop", 42.5, "+"]);
  });

  it("should handle multiple lines with mixed content", () => {
    const values = getTokenValues("5 3 +\n// Comment\n10 20 -\nswap");
    expect(values).toEqual([5, 3, "+", 10, 20, "-", "swap"]);
  });

  it("should handle empty input", () => {
    const tokenizer = new Tokenizer("");
    expect(tokenizer.nextToken().type).toBe(TokenType.EOF);
  });

  // Test 7: Complex expressions
  it("should tokenize complex expressions", () => {
    const values = getTokenValues("5 dup { 3 + } drop");
    expect(values).toEqual([5, "dup", "{", 3, "+", "}", "drop"]);
  });

  it("should handle nested expressions", () => {
    const values = getTokenValues("{ { 5 } { 3 } + }");
    expect(values).toEqual(["{", "{", 5, "}", "{", 3, "}", "+", "}"]);
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
  it("should handle multiple special characters in a row", () => {
    const values = getTokenValues("{{}}");
    expect(values).toEqual(["{", "{", "}", "}"]);
  });

  // New tests specific to Tokenizer

  // Test 11: Token position tracking
  it("should track token positions correctly", () => {
    const tokens = getAllTokens("5 hello");

    expect(tokens[0].position).toBe(0); // "5" starts at position 0
    expect(tokens[1].position).toBe(2); // "hello" starts at position 2
  });

  // Test 12: Line and column tracking
  it("should track line and column numbers", () => {
    const tokenizer = new Tokenizer("hello\nworld");
    const token1 = tokenizer.nextToken();
    const token2 = tokenizer.nextToken();

    expect(tokenizer.getPosition().line).toBe(2);
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

  it("should throw error when pushing back multiple tokens", () => {
    const tokenizer = new Tokenizer("5 10");
    const token1 = tokenizer.nextToken();
    const token2 = tokenizer.nextToken();

    tokenizer.pushBack(token2);
    expect(() => tokenizer.pushBack(token1)).toThrow(
      "Cannot push back more than one token"
    );
  });

  // Test 14: String literals
  it("should tokenize string literals", () => {
    const tokens = getAllTokens('"Hello world"');

    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.STRING);
    expect(tokens[0].value).toBe("Hello world");
  });

  it("should handle escaped characters in strings", () => {
    const tokens = getAllTokens('"Hello\\nWorld\\t\\"Escaped\\"\\r\\\\"');

    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.STRING);
    expect(tokens[0].value).toBe('Hello\nWorld\t"Escaped"\r\\');
  });

  it("should throw error for unterminated string", () => {
    expect(() => {
      const tokenizer = new Tokenizer('"Unterminated string');
      // Consume all tokens to trigger the error
      while (tokenizer.nextToken().type !== TokenType.EOF) {}
    }).toThrow("Unterminated string literal");
  });

  it("should handle mixed strings and other tokens", () => {
    const values = getTokenValues('5 "hello" +');
    expect(values).toEqual([5, "hello", "+"]);
  });
});
