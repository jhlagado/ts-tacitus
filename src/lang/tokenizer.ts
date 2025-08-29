/**
 * @file src/lang/tokenizer.ts
 * Tokenizer for the Tacit language.
 */

import { TokenError, UnterminatedStringError } from '../core/errors';
import { isDigit, isWhitespace, isSpecialChar } from '../core/utils';

/**
 * Token types for the Tacit tokenizer.
 */
export enum TokenType {
  NUMBER,
  WORD,
  STRING,
  SPECIAL,
  BLOCK_START,
  BLOCK_END,
  WORD_QUOTE,
  SYMBOL,
  EOF,
}

/**
 * Token value type.
 */
export type TokenValue = number | string | null;

/**
 * Token in the Tacit language.
 */
export interface Token {
  type: TokenType;
  value: TokenValue;
  position?: number;
}

/**
 * Tokenizer for converting source code into tokens.
 */
export class Tokenizer {
  public input: string;
  public position: number;
  public line: number;
  public column: number;
  private pushedBack: Token | null;
  /**
   * Creates a new Tokenizer instance.
   * @param input Source code to tokenize
   */
  constructor(input: string) {
    this.input = input;
    this.position = 0;
    this.pushedBack = null;
    this.line = 1;
    this.column = 1;
  }

  /**
   * Pushes token back for lookahead parsing.
   * @param token Token to push back
   * @throws {TokenError} If token already pushed back
   */
  pushBack(token: Token): void {
    if (this.pushedBack !== null) {
      throw new TokenError('Cannot push back more than one token', this.line, this.column);
    }

    this.pushedBack = token;
  }

  /**
   * Retrieves the next token from the input stream.
   *
   * This is the main method for consuming tokens from the source code.
   * It handles all token types and manages the tokenizer's position.
   *
   * @returns {Token} The next token in the input stream
   */
  nextToken(): Token {
    if (this.pushedBack !== null) {
      const token = this.pushedBack;
      this.pushedBack = null;
      return token;
    }

    this.skipWhitespace();
    if (this.position >= this.input.length) {
      return {
        type: TokenType.EOF,
        value: null,
        position: this.position,
      };
    }

    const char = this.input[this.position];
    const startPos = this.position;

    if (char === '\\') {
      this.skipComment();
      return this.nextToken();
    }

    if (char === '"') {
      return this.readString();
    }

    if (
      isDigit(char) ||
      ((char === '+' || char === '-' || char === '.') &&
        this.position + 1 < this.input.length &&
        isDigit(this.input[this.position + 1]))
    ) {
      let pos = this.position;
      if (this.input[pos] === '+' || this.input[pos] === '-') {
        pos++;
      }

      while (pos < this.input.length && isDigit(this.input[pos])) {
        pos++;
      }

      if (pos < this.input.length && this.input[pos] === '.') {
        pos++;
        while (pos < this.input.length && isDigit(this.input[pos])) {
          pos++;
        }
      }

      if (
        pos < this.input.length &&
        !isWhitespace(this.input[pos]) &&
        !isSpecialChar(this.input[pos])
      ) {
        return this.readWord();
      }

      return this.readNumber();
    }

    if (char === ':' || char === ';') {
      this.position++;
      this.column++;
      return { type: TokenType.SPECIAL, value: char, position: startPos };
    }

    if ('()[]'.includes(char)) {
      this.position++;
      this.column++;
      return { type: TokenType.SPECIAL, value: char, position: startPos };
    }

    if (char === '{' || char === '}') {
      const type = char === '{' ? TokenType.BLOCK_START : TokenType.BLOCK_END;
      this.position++;
      this.column++;
      return { type, value: char, position: startPos };
    }

    if (char === '`') {
      this.position++;
      this.column++;
      const wordStartPos = this.position;
      let word = '';
      while (
        this.position < this.input.length &&
        !isWhitespace(this.input[this.position]) &&
        !isSpecialChar(this.input[this.position])
      ) {
        word += this.input[this.position];
        this.position++;
        this.column++;
      }

      return { type: TokenType.WORD_QUOTE, value: word, position: wordStartPos - 1 };
    }

    if (char === '@') {
      this.position++;
      this.column++;
      let symbolName = '';

      while (
        this.position < this.input.length &&
        !isWhitespace(this.input[this.position]) &&
        !isSpecialChar(this.input[this.position])
      ) {
        symbolName += this.input[this.position];
        this.position++;
        this.column++;
      }

      if (symbolName === '') {
        throw new TokenError(
          'Invalid symbol: @ must be followed by a symbol name',
          this.line,
          this.column,
        );
      }

      return { type: TokenType.SYMBOL, value: symbolName, position: startPos };
    }

    if (isSpecialChar(char)) {
      this.position++;
      this.column++;
      return { type: TokenType.SPECIAL, value: char, position: startPos };
    }

    return this.readWord();
  }

  /**
   * Peeks at the next token without consuming it.
   *
   * This method allows for lookahead parsing by examining the next token
   * without advancing the tokenizer's position.
   *
   * @returns {Token | null} The next token in the input stream, or null
   */
  peekToken(): Token | null {
    const currentPosition = this.position;
    const currentLine = this.line;
    const currentColumn = this.column;
    const token = this.nextToken();
    this.position = currentPosition;
    this.line = currentLine;
    this.column = currentColumn;
    return token;
  }

  /**
   * Skips over whitespace characters in the input stream.
   *
   * This method advances the tokenizer's position past any whitespace
   * characters (spaces, tabs, newlines) while updating line and column counts.
   *
   * @private
   */
  private skipWhitespace(): void {
    while (this.position < this.input.length && isWhitespace(this.input[this.position])) {
      if (this.input[this.position] === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }

      this.position++;
    }
  }
  /**
   * Skips over a line comment in the input stream.
   *
   * Comments in Tacit start with a backslash (\) and continue until the end of the line.
   * This method advances the tokenizer's position to the end of the current line.
   *
   * @private
   */
  private skipComment(): void {
    while (this.position < this.input.length && this.input[this.position] !== '\n') {
      this.position++;
    }
  }
  /**
   * Reads a string literal from the input stream.
   *
   * String literals in Tacit are enclosed in double quotes and may contain escape sequences.
   * This method processes the string, handling escape sequences, and returns a STRING token.
   *
   * @private
   * @returns {Token} A token of type STRING with the processed string value
   * @throws {Error} If the string literal is unterminated
   */
  private readString(): Token {
    const startPos = this.position;
    let value = '';

    this.position++;
    this.column++;

    while (this.position < this.input.length && this.input[this.position] !== '"') {
      if (this.input[this.position] === '\\' && this.position + 1 < this.input.length) {
        this.position++;
        this.column++;
        const escapeChar = this.input[this.position];
        switch (escapeChar) {
          case 'n':
            value += '\n';
            break;
          case 't':
            value += '\t';
            break;
          case 'r':
            value += '\r';
            break;
          case '"':
            value += '"';
            break;
          case '\\':
            value += '\\';
            break;
          default:
            value += escapeChar;
        }
      } else {
        value += this.input[this.position];
      }

      if (this.input[this.position] === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }

      this.position++;
    }

    if (this.position < this.input.length) {
      this.position++;
      this.column++;
    } else {
      throw new UnterminatedStringError(this.line, this.column);
    }

    return { type: TokenType.STRING, value, position: startPos };
  }

  /**
   * Reads a numeric literal from the input stream.
   *
   * Numeric literals in Tacit can be integers or floating point numbers,
   * optionally preceded by a sign (+ or -). This method processes the number
   * and returns a NUMBER token with the numeric value.
   *
   * @private
   * @returns {Token} A token of type NUMBER with the numeric value, or WORD if parsing fails
   */
  private readNumber(): Token {
    const startPos = this.position;
    let tokenStr = '';

    if (this.input[this.position] === '+' || this.input[this.position] === '-') {
      tokenStr += this.input[this.position];
      this.position++;
      this.column++;
    }

    while (this.position < this.input.length && isDigit(this.input[this.position])) {
      tokenStr += this.input[this.position];
      this.position++;
      this.column++;
    }

    if (this.position < this.input.length && this.input[this.position] === '.') {
      tokenStr += this.input[this.position];
      this.position++;
      this.column++;
      while (this.position < this.input.length && isDigit(this.input[this.position])) {
        tokenStr += this.input[this.position];
        this.position++;
        this.column++;
      }
    }

    const value = Number(tokenStr);
    if (isNaN(value)) {
      return { type: TokenType.WORD, value: tokenStr, position: startPos };
    }

    return { type: TokenType.NUMBER, value, position: startPos };
  }

  /**
   * Reads a word (identifier) from the input stream.
   *
   * Words in Tacit are sequences of characters that are not whitespace or special characters.
   * This method processes the word and returns a WORD token.
   *
   * @private
   * @returns {Token} A token of type WORD with the word value
   */
  private readWord(): Token {
    const startPos = this.position;
    let word = '';

    while (
      this.position < this.input.length &&
      !isWhitespace(this.input[this.position]) &&
      !isSpecialChar(this.input[this.position])
    ) {
      word += this.input[this.position];
      this.position++;
      this.column++;
    }

    return { type: TokenType.WORD, value: word, position: startPos };
  }

  /**
   * Gets the current position in the source code as line and column numbers.
   *
   * This method is useful for error reporting and debugging.
   *
   * @returns {Object} An object containing the current line and column numbers
   */
  getPosition(): { line: number; column: number } {
    return { line: this.line, column: this.column };
  }
}
