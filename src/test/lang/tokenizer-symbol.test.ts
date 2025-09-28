/**
 * @fileoverview Tests for Step 13: @symbol tokenization in the tokenizer.
 *
 * This test suite validates the tokenizer's ability to recognize and parse
 * @symbol syntax for the unified code reference system.
 *
 * Coverage:
 * - Basic @symbol parsing
 * - Edge cases (empty symbols, malformed syntax)
 * - Integration with other token types
 * - Position tracking for symbols
 *
 * @author Tacit VM
 * @version 1.0.0
 */

import { Tokenizer, TokenType } from '../../lang/tokenizer';

describe('Tokenizer @symbol Support - Step 13', () => {
  let tokenizer: Tokenizer;

  describe('Basic @symbol tokenization', () => {
    it('should tokenize a simple @symbol', () => {
      tokenizer = new Tokenizer('@add');
      const token = tokenizer.nextToken();

      expect(token.type).toBe(TokenType.SYMBOL);
      expect(token.value).toBe('add');
      expect(token.position).toBe(0);
    });

    it('should tokenize multiple @symbols', () => {
      tokenizer = new Tokenizer('@add @sub @mul');

      const token1 = tokenizer.nextToken();
      expect(token1.type).toBe(TokenType.SYMBOL);
      expect(token1.value).toBe('add');

      const token2 = tokenizer.nextToken();
      expect(token2.type).toBe(TokenType.SYMBOL);
      expect(token2.value).toBe('sub');

      const token3 = tokenizer.nextToken();
      expect(token3.type).toBe(TokenType.SYMBOL);
      expect(token3.value).toBe('mul');
    });

    it('should tokenize @symbols with underscores and hyphens', () => {
      tokenizer = new Tokenizer('@list-append @stack_depth @my-word');

      const token1 = tokenizer.nextToken();
      expect(token1.type).toBe(TokenType.SYMBOL);
      expect(token1.value).toBe('list-append');

      const token2 = tokenizer.nextToken();
      expect(token2.type).toBe(TokenType.SYMBOL);
      expect(token2.value).toBe('stack_depth');

      const token3 = tokenizer.nextToken();
      expect(token3.type).toBe(TokenType.SYMBOL);
      expect(token3.value).toBe('my-word');
    });

    it('should tokenize @symbols with numbers', () => {
      tokenizer = new Tokenizer('@word2 @test123 @func42');

      const token1 = tokenizer.nextToken();
      expect(token1.type).toBe(TokenType.SYMBOL);
      expect(token1.value).toBe('word2');

      const token2 = tokenizer.nextToken();
      expect(token2.type).toBe(TokenType.SYMBOL);
      expect(token2.value).toBe('test123');

      const token3 = tokenizer.nextToken();
      expect(token3.type).toBe(TokenType.SYMBOL);
      expect(token3.value).toBe('func42');
    });
  });

  describe('@symbol edge cases', () => {
    it('should throw error for @ without symbol name', () => {
      tokenizer = new Tokenizer('@');

      expect(() => {
        tokenizer.nextToken();
      }).toThrow('Invalid symbol: @ must be followed by a symbol name');
    });

    it('should throw error for @ followed by whitespace', () => {
      tokenizer = new Tokenizer('@ add');

      expect(() => {
        tokenizer.nextToken();
      }).toThrow('Invalid symbol: @ must be followed by a symbol name');
    });

    it('should throw error for @ followed by special character', () => {
      tokenizer = new Tokenizer('@(');

      expect(() => {
        tokenizer.nextToken();
      }).toThrow('Invalid symbol: @ must be followed by a symbol name');
    });

    it('should handle @ at end of input', () => {
      tokenizer = new Tokenizer('word @');

      tokenizer.nextToken();

      expect(() => {
        tokenizer.nextToken();
      }).toThrow('Invalid symbol: @ must be followed by a symbol name');
    });
  });

  describe('@symbol integration with other tokens', () => {
    it('should tokenize mixed @symbols and words', () => {
      tokenizer = new Tokenizer('10 @add 20 @sub');

      const token1 = tokenizer.nextToken();
      expect(token1.type).toBe(TokenType.NUMBER);
      expect(token1.value).toBe(10);

      const token2 = tokenizer.nextToken();
      expect(token2.type).toBe(TokenType.SYMBOL);
      expect(token2.value).toBe('add');

      const token3 = tokenizer.nextToken();
      expect(token3.type).toBe(TokenType.NUMBER);
      expect(token3.value).toBe(20);

      const token4 = tokenizer.nextToken();
      expect(token4.type).toBe(TokenType.SYMBOL);
      expect(token4.value).toBe('sub');
    });

    it('should tokenize @symbols with special characters', () => {
      tokenizer = new Tokenizer('(@add) [@sub] (@mul)');

      const token1 = tokenizer.nextToken();
      expect(token1.type).toBe(TokenType.SPECIAL);
      expect(token1.value).toBe('(');

      const token2 = tokenizer.nextToken();
      expect(token2.type).toBe(TokenType.SYMBOL);
      expect(token2.value).toBe('add');

      const token3 = tokenizer.nextToken();
      expect(token3.type).toBe(TokenType.SPECIAL);
      expect(token3.value).toBe(')');

      const token4 = tokenizer.nextToken();
      expect(token4.type).toBe(TokenType.SPECIAL);
      expect(token4.value).toBe('[');

      const token5 = tokenizer.nextToken();
      expect(token5.type).toBe(TokenType.SYMBOL);
      expect(token5.value).toBe('sub');

      const token6 = tokenizer.nextToken();
      expect(token6.type).toBe(TokenType.SPECIAL);
      expect(token6.value).toBe(']');
    });

    it('should tokenize @symbols in word definitions', () => {
      tokenizer = new Tokenizer(': double @dup @add ;');

      const token1 = tokenizer.nextToken();
      expect(token1.type).toBe(TokenType.WORD);
      expect(token1.value).toBe(':');

      const token2 = tokenizer.nextToken();
      expect(token2.type).toBe(TokenType.WORD);
      expect(token2.value).toBe('double');

      const token3 = tokenizer.nextToken();
      expect(token3.type).toBe(TokenType.SYMBOL);
      expect(token3.value).toBe('dup');

      const token4 = tokenizer.nextToken();
      expect(token4.type).toBe(TokenType.SYMBOL);
      expect(token4.value).toBe('add');

      const token5 = tokenizer.nextToken();
      expect(token5.type).toBe(TokenType.WORD);
      expect(token5.value).toBe(';');
    });
  });

  describe('@symbol position tracking', () => {
    it('should track positions correctly for @symbols', () => {
      tokenizer = new Tokenizer('  @add  @sub  ');

      const token1 = tokenizer.nextToken();
      expect(token1.type).toBe(TokenType.SYMBOL);
      expect(token1.value).toBe('add');
      expect(token1.position).toBe(2);

      const token2 = tokenizer.nextToken();
      expect(token2.type).toBe(TokenType.SYMBOL);
      expect(token2.value).toBe('sub');
      expect(token2.position).toBe(8);
    });

    it('should handle line and column tracking for @symbols', () => {
      tokenizer = new Tokenizer('line1\n@symbol');

      tokenizer.nextToken();

      const symbolToken = tokenizer.nextToken();
      expect(symbolToken.type).toBe(TokenType.SYMBOL);
      expect(symbolToken.value).toBe('symbol');
      expect(symbolToken.position).toBe(6);
    });
  });

  describe('@symbol boundary conditions', () => {
    it('should stop at whitespace after @symbol', () => {
      tokenizer = new Tokenizer('@symbol word');

      const token1 = tokenizer.nextToken();
      expect(token1.type).toBe(TokenType.SYMBOL);
      expect(token1.value).toBe('symbol');

      const token2 = tokenizer.nextToken();
      expect(token2.type).toBe(TokenType.WORD);
      expect(token2.value).toBe('word');
    });

    it('should stop at special characters after @symbol', () => {
      tokenizer = new Tokenizer('@symbol(');

      const token1 = tokenizer.nextToken();
      expect(token1.type).toBe(TokenType.SYMBOL);
      expect(token1.value).toBe('symbol');

      const token2 = tokenizer.nextToken();
      expect(token2.type).toBe(TokenType.SPECIAL);
      expect(token2.value).toBe('(');
    });

    it('should handle @symbol at end of input', () => {
      tokenizer = new Tokenizer('@symbol');

      const token1 = tokenizer.nextToken();
      expect(token1.type).toBe(TokenType.SYMBOL);
      expect(token1.value).toBe('symbol');

      const token2 = tokenizer.nextToken();
      expect(token2.type).toBe(TokenType.EOF);
    });
  });
});
