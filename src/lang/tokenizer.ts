/**
 * Simplified tokenizer for the minimal Forth-like language implementation
 * Following basic Forth principles with backslash comments
 */
export enum TokenType {
  NUMBER,  // For numeric literals
  WORD,    // For identifiers and words
  SPECIAL, // For special characters like : and ;
  EOF      // End of file/input
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
  private tokens: Token[];
  private currentTokenIndex: number;

  constructor(input: string) {
    this.input = input;
    this.position = 0;
    this.tokens = [];
    this.currentTokenIndex = 0;
    
    // Pre-tokenize the input on construction
    this.tokenizeInput();
  }

  /**
   * Tokenize the entire input string, handling Forth-style \ comments
   */
  private tokenizeInput(): void {
    // Process the input line by line to handle comments
    const lines = this.input.split('\n');
    let position = 0;
    
    for (const line of lines) {
      // Check if the line contains a comment
      const commentIndex = line.indexOf('\\');
      
      // Get the part of the line before any comment
      const activeLine = commentIndex >= 0 ? line.substring(0, commentIndex) : line;
      
      // Split the active part by whitespace
      const words = activeLine.trim().split(/\s+/).filter(word => word.length > 0);
      
      for (const word of words) {
        // Handle numbers
        if (/^[+-]?\d+(\.\d+)?$/.test(word)) {
          this.tokens.push({
            type: TokenType.NUMBER,
            value: parseFloat(word),
            position: position
          });
        }
        // Handle special characters
        else if ([":", ";", "."].includes(word)) {
          this.tokens.push({
            type: TokenType.SPECIAL,
            value: word,
            position: position
          });
        }
        // Everything else is a word
        else {
          this.tokens.push({
            type: TokenType.WORD,
            value: word,
            position: position
          });
        }
        
        position += word.length + 1; // +1 for the space
      }
      
      position += 1; // +1 for the newline
    }
    
    // Add EOF token
    this.tokens.push({
      type: TokenType.EOF,
      value: null,
      position: this.input.length
    });
  }

  /**
   * Get the next token
   */
  nextToken(): Token {
    if (this.currentTokenIndex >= this.tokens.length) {
      return this.tokens[this.tokens.length - 1]; // Return EOF token
    }
    
    return this.tokens[this.currentTokenIndex++];
  }

  /**
   * Peek at the next token without advancing
   */
  peekToken(): Token | null {
    if (this.currentTokenIndex >= this.tokens.length) {
      return this.tokens[this.tokens.length - 1]; // Return EOF token
    }
    
    return this.tokens[this.currentTokenIndex];
  }

  /**
   * Push a token back (to be returned on next call)
   * Note: In this simplified implementation, we just decrement the index
   */
  pushBack(_token: Token): void {
    if (this.currentTokenIndex > 0) {
      this.currentTokenIndex--;
    }
  }

  /**
   * Get the current position
   */
  getPosition(): { line: number; column: number } {
    // In our simplified tokenizer, we don't track lines and columns
    // but we maintain the interface for compatibility
    return { line: 1, column: this.position };
  }
}
