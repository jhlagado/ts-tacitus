import { isDigit, isWhitespace, isGroupingChar } from "./utils";

export enum TokenType {
  NUMBER,
  WORD,
  STRING,
  SPECIAL, // For special characters like (, ), etc.
  EOF,
}

export type TokenValue = number | string | null;

export interface Token {
  type: TokenType;
  value: TokenValue;
  position: number;
}

export class Tokenizer {
  private input: string;
  private position: number;
  private pushedBack: Token | null;
  private line: number;
  private column: number;

  constructor(input: string) {
    this.input = input;
    this.position = 0;
    this.pushedBack = null;
    this.line = 1;
    this.column = 1;
  }

  /**
   * Push back a token to be returned on the next call to nextToken()
   */
  pushBack(token: Token): void {
    if (this.pushedBack !== null) {
      throw new Error("Cannot push back more than one token");
    }
    this.pushedBack = token;
  }

  /**
   * Get the next token from the input
   */
  nextToken(): Token {
    // Return pushed back token if it exists
    if (this.pushedBack !== null) {
      const token = this.pushedBack;
      this.pushedBack = null;
      return token;
    }

    // Skip whitespace
    this.skipWhitespace();

    // Check if we've reached the end of the input
    if (this.position >= this.input.length) {
      return {
        type: TokenType.EOF,
        value: null,
        position: this.position,
      };
    }

    const char = this.input[this.position];
    const startPos = this.position;

    // Handle comments
    if (
      char === "/" &&
      this.position + 1 < this.input.length &&
      this.input[this.position + 1] === "/"
    ) {
      this.skipComment();
      return this.nextToken(); // Skip comments and get next token
    }

    // Handle string literals
    if (char === '"') {
      return this.readString();
    }

    // Handle numbers
    if (
      isDigit(char) ||
      ((char === "+" || char === "-" || char === ".") &&
        this.position + 1 < this.input.length &&
        isDigit(this.input[this.position + 1]))
    ) {
      return this.readNumber();
    }

    // Handle special instruction characters
    if (char === ":" || char === ";") {
      const value = char;
      this.position++;
      this.column++;
      return {
        type: TokenType.SPECIAL,
        value,
        position: startPos,
      };
    }

    // Handle grouping characters
    if (isGroupingChar(char)) {
      const value = char;
      this.position++;
      this.column++;
      return {
        type: TokenType.SPECIAL,
        value,
        position: startPos,
      };
    }

    // Handle words/identifiers
    return this.readWord();
  }

  private skipWhitespace(): void {
    while (
      this.position < this.input.length &&
      isWhitespace(this.input[this.position])
    ) {
      if (this.input[this.position] === "\n") {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.position++;
    }
  }

  private skipComment(): void {
    while (
      this.position < this.input.length &&
      this.input[this.position] !== "\n"
    ) {
      this.position++;
    }
    // Don't skip the newline - let skipWhitespace handle it
  }

  private readString(): Token {
    const startPos = this.position;
    let value = "";

    // Skip opening quote
    this.position++;
    this.column++;

    while (
      this.position < this.input.length &&
      this.input[this.position] !== '"'
    ) {
      // Handle escape sequences
      if (
        this.input[this.position] === "\\" &&
        this.position + 1 < this.input.length
      ) {
        this.position++;
        this.column++;

        switch (this.input[this.position]) {
          case "n":
            value += "\n";
            break;
          case "t":
            value += "\t";
            break;
          case "r":
            value += "\r";
            break;
          case '"':
            value += '"';
            break;
          case "\\":
            value += "\\";
            break;
          default:
            value += this.input[this.position]; // Unrecognized escape
        }
      } else {
        value += this.input[this.position];
      }

      if (this.input[this.position] === "\n") {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }

      this.position++;
    }

    if (this.position < this.input.length) {
      // Skip closing quote
      this.position++;
      this.column++;
    } else {
      throw new Error(
        `Unterminated string literal at line ${this.line}, column ${this.column}`
      );
    }

    return {
      type: TokenType.STRING,
      value,
      position: startPos,
    };
  }

  private readNumber(): Token {
    const startPos = this.position;
    let tokenStr = "";

    // Handle sign
    if (
      this.input[this.position] === "+" ||
      this.input[this.position] === "-"
    ) {
      tokenStr += this.input[this.position];
      this.position++;
      this.column++;
    }

    // Read digits before decimal point
    while (
      this.position < this.input.length &&
      isDigit(this.input[this.position])
    ) {
      tokenStr += this.input[this.position];
      this.position++;
      this.column++;
    }

    // Check if this is actually a word that starts with digits
    // (like 123name)
    if (
      this.position < this.input.length &&
      !isWhitespace(this.input[this.position]) &&
      !isGroupingChar(this.input[this.position]) &&
      this.input[this.position] !== "."
    ) {
      // Continue reading as a word
      while (
        this.position < this.input.length &&
        !isWhitespace(this.input[this.position]) &&
        !isGroupingChar(this.input[this.position])
      ) {
        tokenStr += this.input[this.position];
        this.position++;
        this.column++;
      }

      return {
        type: TokenType.WORD,
        value: tokenStr,
        position: startPos,
      };
    }

    // Handle decimal point
    if (
      this.position < this.input.length &&
      this.input[this.position] === "."
    ) {
      tokenStr += this.input[this.position];
      this.position++;
      this.column++;

      // Read digits after decimal point
      while (
        this.position < this.input.length &&
        isDigit(this.input[this.position])
      ) {
        tokenStr += this.input[this.position];
        this.position++;
        this.column++;
      }
    }

    const value = Number(tokenStr);
    if (isNaN(value)) {
      // If it's not a valid number, treat it as a word
      return {
        type: TokenType.WORD,
        value: tokenStr,
        position: startPos,
      };
    }

    return {
      type: TokenType.NUMBER,
      value,
      position: startPos,
    };
  }

  private readWord(): Token {
    const startPos = this.position;
    let word = "";

    while (
      this.position < this.input.length &&
      !isWhitespace(this.input[this.position]) &&
      !isGroupingChar(this.input[this.position])
    ) {
      word += this.input[this.position];
      this.position++;
      this.column++;
    }

    return {
      type: TokenType.WORD,
      value: word,
      position: startPos,
    };
  }

  /**
   * Get current line and column for error reporting
   */
  getPosition(): { line: number; column: number } {
    return { line: this.line, column: this.column };
  }
}
