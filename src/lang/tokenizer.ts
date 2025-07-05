export enum TokenType {
  NUMBER = 'NUMBER',
  WORD = 'WORD',
  SPECIAL = 'SPECIAL',
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  COLON = 'COLON',
  SEMICOLON = 'SEMICOLON',
  EOF = 'EOF'
}

export type TokenValue = number | string | null;

export interface Token {
  type: TokenType;
  value: TokenValue;
  position: number;
  line: number;
  column: number;
}

export class Tokenizer {
  private input: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private pushedBackToken: Token | null = null;

  constructor(input: string) {
    this.input = input;
  }

  /**
   * Get the input string being tokenized
   */
  public getInput(): string {
    return this.input;
  }

  private isWhitespace(char: string): boolean {
    return /\s/.test(char);
  }

  private isDigit(char: string): boolean {
    return /[0-9]/.test(char);
  }

  private isWordChar(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
  }

  private isSpecialChar(char: string): boolean {
    return /[{}:;.,+\-*/=<>!?@#$%^&|~`'\[\]()]/.test(char);
  }

  private isLetter(char: string): boolean {
    return /[a-zA-Z_]/.test(char);
  }

  /**
   * Push a token back to be returned by the next call to nextToken()
   */
  public pushBack(token: Token): void {
    this.pushedBackToken = token;
  }

  /**
   * Get the next token from the input
   */
  public nextToken(): Token {
    // Return any pushed back token first
    if (this.pushedBackToken !== null) {
      const token = this.pushedBackToken;
      this.pushedBackToken = null;
      return token;
    }

    // Skip whitespace
    this.skipWhitespace();

    // Check for end of input
    if (this.position >= this.input.length) {
      return {
        type: TokenType.EOF,
        value: null,
        position: this.position,
        line: this.line,
        column: this.column
      };
    }

    // Check for comments first
    if ((this.input[this.position] === '\\') || 
        (this.input[this.position] === '/' && this.position + 1 < this.input.length && this.input[this.position + 1] === '/')) {
      this.skipComment();
      return this.nextToken();
    }

    const char = this.input[this.position];

    // Check for numbers or negative numbers (but not just a minus sign)
    if (this.isDigit(char) || 
        (char === '-' && 
         this.position + 1 < this.input.length && 
         this.isDigit(this.input[this.position + 1]) &&
         (this.position === 0 || this.isWhitespace(this.input[this.position - 1])))) {
      return this.readNumber();
    }

    // Handle words (identifiers)
    if (this.isLetter(char)) {
      return this.readWord();
    }

    // Handle special characters
    if (this.isSpecialChar(char)) {
      return this.readSpecial();
    }

    // Handle colon (start of definition)
    if (char === ':') {
      const token = {
        type: TokenType.COLON,
        value: ':',
        position: this.position,
        line: this.line,
        column: this.column
      };
      this.position++;
      this.column++;
      return token;
    }

    // Handle semicolon (end of definition)
    if (char === ';') {
      const token = {
        type: TokenType.SEMICOLON,
        value: ';',
        position: this.position,
        line: this.line,
        column: this.column
      };
      this.position++;
      this.column++;
      return token;
    }

    // Handle unknown character (skip it with a warning)
    console.warn(`Unknown character '${char}' at line ${this.line}, column ${this.column}`);
    this.position++;
    this.column++;
    return this.nextToken();
  }

  private skipWhitespace(): void {
    while (this.position < this.input.length) {
      const char = this.input[this.position];
      if (!this.isWhitespace(char)) break;

      if (char === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.position++;
    }
  }

  private readNumber(): Token {
    const startPos = this.position;
    const startLine = this.line;
    const startCol = this.column;
    let value = '';
    let hasDecimal = false;

    // Check if this is a negative number (only if '-' is followed by a digit)
    if (this.input[this.position] === '-' && 
        this.position + 1 < this.input.length && 
        this.isDigit(this.input[this.position + 1])) {
      value = '-';
      this.position++;
      this.column++;
      
      // If next character is not a digit, treat as a special token
      if (this.position >= this.input.length || !this.isDigit(this.input[this.position])) {
        this.position = startPos;
        this.column = startCol;
        return this.readSpecial();
      }
    } else if (this.input[this.position] === '+') {
      // Handle explicit positive numbers
      this.position++;
      this.column++;
      // If next character is not a digit, treat as a special token
      if (this.position >= this.input.length || !this.isDigit(this.input[this.position])) {
        this.position = startPos;
        this.column = startCol;
        return this.readSpecial();
      }
    }

    // Read integer part
    while (this.position < this.input.length && this.isDigit(this.input[this.position])) {
      value += this.input[this.position];
      this.position++;
      this.column++;
    }

    // Check for decimal point
    if (this.position < this.input.length && this.input[this.position] === '.') {
      hasDecimal = true;
      value += '.';
      this.position++;
      this.column++;
      
      // Read fractional part
      while (this.position < this.input.length && this.isDigit(this.input[this.position])) {
        value += this.input[this.position];
        this.position++;
        this.column++;
      }
    }

    // If we only have a sign, it's not a valid number
    if (value === '-' || value === '+' || value === '.') {
      this.position = startPos;
      this.column = startCol;
      return this.readSpecial();
    }

    // Convert to number, handling leading zeros
    let numValue: number;
    if (hasDecimal || value.includes('.')) {
      numValue = parseFloat(value);
      // Handle cases like '00.5' which should be 0.5
      if (value.startsWith('0') && value.length > 1 && value[1] !== '.') {
        numValue = parseFloat('0' + value.substring(value.search(/[^0]/)));
      }
    } else {
      numValue = parseInt(value, 10);
      // Handle leading zeros in integers
      if (value.length > 1 && value[0] === '0') {
        numValue = parseInt('0' + value.replace(/^0+/, ''), 10);
      }
    }

    return {
      type: TokenType.NUMBER,
      value: numValue,
      position: startPos,
      line: startLine,
      column: startCol
    };
  }

  private readWord(): Token {
    const startPos = this.position;
    const startLine = this.line;
    const startCol = this.column;
    let value = '';

    // Check for quoted string
    if (this.input[this.position] === '"') {
      value = '"';
      this.position++;
      this.column++;

      // Read until closing quote or end of input
      while (this.position < this.input.length && this.input[this.position] !== '"') {
        value += this.input[this.position];
        this.position++;
        this.column++;
      }

      // Add closing quote if found
      if (this.position < this.input.length && this.input[this.position] === '"') {
        value += '"';
        this.position++;
        this.column++;
      }

      return {
        type: TokenType.WORD,
        value,
        position: startPos,
        line: startLine,
        column: startCol
      };
    }

    // For regular words, read until whitespace or special character
    while (this.position < this.input.length) {
      const char = this.input[this.position];
      if (this.isWhitespace(char) || this.isSpecialChar(char)) {
        break;
      }
      value += char;
      this.position++;
      this.column++;
    }

    // If we have a word that starts with a number followed by letters, split it
    if (/^\d+[a-zA-Z_]/.test(value)) {
      const numMatch = value.match(/^(\d+)/);
      if (numMatch) {
        // Push back the non-numeric part for the next token
        const numLength = numMatch[0].length;
        const numValue = value.substring(0, numLength);
        const wordValue = value.substring(numLength);
        
        // Adjust position for the word part that we're pushing back
        this.position -= wordValue.length;
        this.column -= wordValue.length;
        
        return {
          type: TokenType.NUMBER,
          value: parseInt(numValue, 10),
          position: startPos,
          line: startLine,
          column: startCol
        };
      }
    }

    return {
      type: TokenType.WORD,
      value,
      position: startPos,
      line: startLine,
      column: startCol
    };
  }

  private skipComment(): void {
    const isForthStyle = this.input[this.position] === '\\';
    const isCppStyle = this.input[this.position] === '/' && 
                      this.position + 1 < this.input.length && 
                      this.input[this.position + 1] === '/';
    
    if (!isForthStyle && !isCppStyle) return;
    
    // Skip the comment start characters
    if (isForthStyle) {
      this.position++;
    } else {
      this.position += 2; // Skip '//'
    }
    
    // Skip until end of line
    while (this.position < this.input.length && this.input[this.position] !== '\n') {
      this.position++;
    }
    
    // Skip the newline character if present
    if (this.position < this.input.length && this.input[this.position] === '\n') {
      this.position++;
      this.line++;
      this.column = 1;
    }
  }

  private readSpecial(): Token {
    const startPos = this.position;
    const startLine = this.line;
    const startCol = this.column;
    const char = this.input[this.position];
    
    // Process the special character
    this.position++;
    this.column++;
    
    // Special case for handling multiple special characters in a row
    // Each special character is its own token, including braces
    if (char === '{' || char === '}') {
      return {
        type: char === '{' ? TokenType.LBRACE : TokenType.RBRACE,
        value: char,
        position: startPos,
        line: startLine,
        column: startCol
      };
    }

    // Handle special characters
    switch (char) {
      case '{':
        return { type: TokenType.LBRACE, value: char, position: startPos, line: startLine, column: startCol };
      case '}':
        return { type: TokenType.RBRACE, value: char, position: startPos, line: startLine, column: startCol };
      case ':':
        return { type: TokenType.COLON, value: char, position: startPos, line: startLine, column: startCol };
      case ';':
        return { type: TokenType.SEMICOLON, value: char, position: startPos, line: startLine, column: startCol };
      case '(':
      case ')':
      case '[':
      case ']':
      case '.':
      case ',':
      case '*':
      case '/':
      case '+':
      case '-':
      case '=':
      case '<':
      case '>':
      case '!':
      case '?':
      case '@':
      case '#':
      case '$':
      case '%':
      case '^':
      case '&':
      case '|':
      case '~':
      case '`':
      case '\'':
        return { type: TokenType.SPECIAL, value: char, position: startPos, line: startLine, column: startCol };
      default:
        return { type: TokenType.WORD, value: char, position: startPos, line: startLine, column: startCol };
    }
  }
}
