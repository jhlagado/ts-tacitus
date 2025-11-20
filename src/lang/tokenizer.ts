/**
 * @file src/lang/tokenizer.ts
 * Tokenizer implemented as plain data + helper functions.
 */

import {
  TokenError,
  UnterminatedStringError,
  isDigit,
  isWhitespace,
  isSpecialChar,
} from '@src/core';

export enum TokenType {
  NUMBER,
  WORD,
  STRING,
  SPECIAL,
  SYMBOL,
  REF_SIGIL,
  EOF,
}

export type TokenValue = number | string | null;

export type Token = {
  type: TokenType;
  value: TokenValue;
  position?: number;
};

export type Tokenizer = {
  input: string;
  position: number;
  line: number;
  column: number;
  pushedBack: Token | null;
};

export function createTokenizer(input: string): Tokenizer {
  return {
    input,
    position: 0,
    line: 1,
    column: 1,
    pushedBack: null,
  };
}

export function tokenizerPushBack(tokenizer: Tokenizer, token: Token): void {
  if (tokenizer.pushedBack !== null) {
    throw new TokenError('Cannot push back more than one token', tokenizer.line, tokenizer.column);
  }
  tokenizer.pushedBack = token;
}

export function tokenizerNext(tokenizer: Tokenizer): Token {
  if (tokenizer.pushedBack !== null) {
    const token = tokenizer.pushedBack;
    tokenizer.pushedBack = null;
    return token;
  }

  tokenizerSkipWhitespace(tokenizer);
  if (tokenizer.position >= tokenizer.input.length) {
    return { type: TokenType.EOF, value: null, position: tokenizer.position };
  }

  const char = tokenizer.input[tokenizer.position];
  const startPos = tokenizer.position;

  if (char === '#') {
    tokenizerSkipComment(tokenizer);
    return tokenizerNext(tokenizer);
  }

  if (char === '"') {
    return tokenizerReadString(tokenizer);
  }

  if (isNumberStart(tokenizer)) {
    if (isWordAfterNumber(tokenizer)) {
      return tokenizerReadWord(tokenizer);
    }
    return tokenizerReadNumber(tokenizer);
  }

  if (char === ':' || char === ';') {
    tokenizer.position += 1;
    tokenizer.column += 1;
    return { type: TokenType.WORD, value: char, position: startPos };
  }

  if ('()[]'.includes(char)) {
    tokenizer.position += 1;
    tokenizer.column += 1;
    return { type: TokenType.SPECIAL, value: char, position: startPos };
  }

  if (char === "'") {
    return tokenizerReadApostropheString(tokenizer, startPos);
  }

  if (char === '@') {
    return tokenizerReadSymbol(tokenizer, startPos);
  }

  if (char === '&') {
    tokenizer.position += 1;
    tokenizer.column += 1;
    return { type: TokenType.REF_SIGIL, value: '&', position: startPos };
  }

  return tokenizerReadWord(tokenizer);
}

function tokenizerSkipWhitespace(tokenizer: Tokenizer): void {
  while (tokenizer.position < tokenizer.input.length) {
    const char = tokenizer.input[tokenizer.position];
    if (isWhitespace(char)) {
      if (char === '\n') {
        tokenizer.line += 1;
        tokenizer.column = 1;
      } else {
        tokenizer.column += 1;
      }
      tokenizer.position += 1;
    } else {
      break;
    }
  }
}

function tokenizerSkipComment(tokenizer: Tokenizer): void {
  while (tokenizer.position < tokenizer.input.length && tokenizer.input[tokenizer.position] !== '\n') {
    tokenizer.position += 1;
    tokenizer.column += 1;
  }
}

function tokenizerReadString(tokenizer: Tokenizer): Token {
  let value = '';
  tokenizer.position += 1;
  tokenizer.column += 1;

  while (tokenizer.position < tokenizer.input.length) {
    const char = tokenizer.input[tokenizer.position];
    if (char === '"') {
      tokenizer.position += 1;
      tokenizer.column += 1;
      return { type: TokenType.STRING, value, position: tokenizer.position - value.length - 2 };
    }
    if (char === '\\') {
      tokenizer.position += 1;
      if (tokenizer.position >= tokenizer.input.length) {
        throw new UnterminatedStringError(tokenizer.line, tokenizer.column);
      }
      const escapeChar = tokenizer.input[tokenizer.position];
      value += escapeCharacter(escapeChar);
    } else {
      value += char;
    }
    tokenizer.position += 1;
    tokenizer.column += 1;
  }

  throw new UnterminatedStringError(tokenizer.line, tokenizer.column);
}

function tokenizerReadApostropheString(tokenizer: Tokenizer, startPos: number): Token {
  tokenizer.position += 1;
  tokenizer.column += 1;
  let word = '';
  while (
    tokenizer.position < tokenizer.input.length &&
    !isWhitespace(tokenizer.input[tokenizer.position]) &&
    !isSpecialChar(tokenizer.input[tokenizer.position])
  ) {
    word += tokenizer.input[tokenizer.position];
    tokenizer.position += 1;
    tokenizer.column += 1;
  }
  return { type: TokenType.STRING, value: word, position: startPos };
}

function tokenizerReadSymbol(tokenizer: Tokenizer, startPos: number): Token {
  tokenizer.position += 1;
  tokenizer.column += 1;
  let symbolName = '';
  while (
    tokenizer.position < tokenizer.input.length &&
    !isWhitespace(tokenizer.input[tokenizer.position]) &&
    !isSpecialChar(tokenizer.input[tokenizer.position])
  ) {
    symbolName += tokenizer.input[tokenizer.position];
    tokenizer.position += 1;
    tokenizer.column += 1;
  }
  if (symbolName === '') {
    throw new TokenError('Invalid symbol: @ must be followed by a symbol name', tokenizer.line, tokenizer.column);
  }
  return { type: TokenType.SYMBOL, value: symbolName, position: startPos };
}

function tokenizerReadNumber(tokenizer: Tokenizer): Token {
  const startPos = tokenizer.position;
  let hasDot = false;

  if (tokenizer.input[tokenizer.position] === '+' || tokenizer.input[tokenizer.position] === '-') {
    tokenizer.position += 1;
    tokenizer.column += 1;
  }

  while (tokenizer.position < tokenizer.input.length && isDigit(tokenizer.input[tokenizer.position])) {
    tokenizer.position += 1;
    tokenizer.column += 1;
  }

  if (tokenizer.position < tokenizer.input.length && tokenizer.input[tokenizer.position] === '.') {
    hasDot = true;
    tokenizer.position += 1;
    tokenizer.column += 1;
    while (tokenizer.position < tokenizer.input.length && isDigit(tokenizer.input[tokenizer.position])) {
      tokenizer.position += 1;
      tokenizer.column += 1;
    }
  }

  const tokenStr = tokenizer.input.slice(startPos, tokenizer.position);
  const value = hasDot ? parseFloat(tokenStr) : parseInt(tokenStr, 10);
  return { type: TokenType.NUMBER, value, position: startPos };
}

function tokenizerReadWord(tokenizer: Tokenizer): Token {
  const startPos = tokenizer.position;
  let word = '';
  while (
    tokenizer.position < tokenizer.input.length &&
    !isWhitespace(tokenizer.input[tokenizer.position]) &&
    !isSpecialChar(tokenizer.input[tokenizer.position])
  ) {
    word += tokenizer.input[tokenizer.position];
    tokenizer.position += 1;
    tokenizer.column += 1;
  }
  return { type: TokenType.WORD, value: word, position: startPos };
}

function isNumberStart(tokenizer: Tokenizer): boolean {
  const char = tokenizer.input[tokenizer.position];
  if (isDigit(char)) {
    return true;
  }
  if (char === '+' || char === '-' || char === '.') {
    const next = tokenizer.input[tokenizer.position + 1] ?? '';
    return isDigit(next);
  }
  return false;
}

function isWordAfterNumber(tokenizer: Tokenizer): boolean {
  let pos = tokenizer.position;
  if (tokenizer.input[pos] === '+' || tokenizer.input[pos] === '-') {
    pos += 1;
  }
  while (pos < tokenizer.input.length && isDigit(tokenizer.input[pos])) {
    pos += 1;
  }
  if (pos < tokenizer.input.length && tokenizer.input[pos] === '.') {
    pos += 1;
    while (pos < tokenizer.input.length && isDigit(tokenizer.input[pos])) {
      pos += 1;
    }
  }
  return pos < tokenizer.input.length && !isWhitespace(tokenizer.input[pos]) && !isSpecialChar(tokenizer.input[pos]);
}

function escapeCharacter(char: string): string {
  switch (char) {
    case 'n':
      return '\n';
    case 't':
      return '\t';
    case '\\':
      return '\\';
    case '"':
      return '"';
    case 'r':
      return '\r';
    default:
      return char;
  }
}
