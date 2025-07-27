/**
 * @file src/lang/tokenizer.ts
 *
 * This file implements the tokenizer (lexical analyzer) for the Tacit language.
 *
 * The tokenizer is responsible for breaking down the input source code into a stream
 * of tokens that can be processed by the parser. It handles various token types including
 * numbers, words (identifiers), strings, special characters, code blocks, and word quotes.
 *
 * The tokenizer also manages source position tracking for error reporting and supports
 * features like token pushback for lookahead parsing.
 */

import { TokenError, UnterminatedStringError } from '../core/errors';
import { isDigit, isWhitespace, isSpecialChar } from '../core/utils';

/**
 * Enumeration of token types recognized by the Tacit tokenizer.
 */
export enum TokenType {
  /** Numeric literal (integer or floating point) */
  NUMBER,
  /** Word/identifier (function name, variable, etc.) */
  WORD,
  /** String literal enclosed in double quotes */
  STRING,
  /** Special character like :, ;, (, ), [, ] */
  SPECIAL,
  /** Opening curly brace { for code blocks */
  BLOCK_START,
  /** Closing curly brace } for code blocks */
  BLOCK_END,
  /** Word quote marker (`) for symbol literals */
  WORD_QUOTE,
  /** End of file marker */
  EOF,
}

/**
 * Represents the value of a token, which can be a number, string, or null (for EOF).
 */
export type TokenValue = number | string | null;

/**
 * Represents a token in the Tacit language.
 *
 * @property {TokenType} type - The type of the token
 * @property {TokenValue} value - The value of the token
 * @property {number} position - The position of the token in the input source
 */
export interface Token {
  type: TokenType;
  value: TokenValue;
  position: number;
}

/**
 * The Tokenizer class is responsible for converting Tacit source code into a stream of tokens.
 *
 * It processes the input character by character, identifying and categorizing language elements
 * such as numbers, words, strings, and special characters. The tokenizer maintains position
 * information for error reporting and supports token pushback for lookahead parsing.
 */
export class Tokenizer {
  /** The input source code being tokenized */
  public input: string;
  /** The current position in the input string */
  public position: number;
  /** The current line number (1-based) for error reporting */
  public line: number;
  /** The current column number (1-based) for error reporting */
  public column: number;
  /** Storage for a single pushed-back token for lookahead parsing */
  private pushedBack: Token | null;
  /**
   * Creates a new Tokenizer instance.
   *
   * @param {string} input - The source code to tokenize
   */
  constructor(input: string) {
    this.input = input;
    this.position = 0;
    this.pushedBack = null;
    this.line = 1;
    this.column = 1;
  }

  /**
   * Pushes a token back into the tokenizer's stream.
   *
   * This allows for lookahead parsing where a token needs to be examined
   * and then put back for later processing.
   *
   * @param {Token} token - The token to push back
   * @throws {TokenError} If there is already a pushed back token
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
