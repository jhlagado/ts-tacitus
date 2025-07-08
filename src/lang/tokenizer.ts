import { isDigit, isWhitespace, isSpecialChar } from '../core/utils';
export enum TokenType {
  NUMBER,
  WORD,
  STRING,
  SPECIAL,
  BLOCK_START,
  BLOCK_END,
  WORD_QUOTE,
  EOF,
}
export type TokenValue = number | string | null;
export interface Token {
  type: TokenType;
  value: TokenValue;
  position: number;
}
export class Tokenizer {
  public input: string;
  public position: number;
  public line: number;
  public column: number;
  private pushedBack: Token | null;
  constructor(input: string) {
    this.input = input;
    this.position = 0;
    this.pushedBack = null;
    this.line = 1;
    this.column = 1;
  }
  pushBack(token: Token): void {
    if (this.pushedBack !== null) {
      throw new Error('Cannot push back more than one token');
    }
    this.pushedBack = token;
  }
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
  private skipComment(): void {
    while (this.position < this.input.length && this.input[this.position] !== '\n') {
      this.position++;
    }
  }
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
      throw new Error(`Unterminated string literal at line ${this.line}, column ${this.column}`);
    }
    return { type: TokenType.STRING, value, position: startPos };
  }
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
  getPosition(): { line: number; column: number } {
    return { line: this.line, column: this.column };
  }
}
