import { Token, Tokenizer, TokenType, TokenValue } from '../../lang/tokenizer';

describe('Tokenizer', () => {
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

  function getAllTokens(input: string): Token[] {
    const tokenizer = new Tokenizer(input);
    const tokens: Token[] = [];
    let token = tokenizer.nextToken();
    while (token.type !== TokenType.EOF) {
      tokens.push(token);
      token = tokenizer.nextToken();
    }

    return tokens;
  }

  test('should tokenize a simple command', () => {
    const tokens = getAllTokens('5 3 add');
    expect(tokens.length).toBe(3);
    expect(tokens[0]).toEqual(expect.objectContaining({ type: TokenType.NUMBER, value: 5 }));
    expect(tokens[1]).toEqual(expect.objectContaining({ type: TokenType.NUMBER, value: 3 }));
    expect(tokens[2]).toEqual(expect.objectContaining({ type: TokenType.WORD, value: 'add' }));
  });
  test('should tokenize a command with multiple operations', () => {
    const values = getTokenValues('5 3 add 2 mul');
    expect(values).toEqual([5, 3, 'add', 2, 'mul']);
  });

  test('should tokenize positive integers', () => {
    const values = getTokenValues('42 100');
    expect(values).toEqual([42, 100]);
  });
  test('should tokenize negative integers', () => {
    const values = getTokenValues('-42 -100');
    expect(values).toEqual([-42, -100]);
  });
  test('should tokenize positive floats', () => {
    const values = getTokenValues('3.14 0.5');
    expect(values).toEqual([3.14, 0.5]);
  });
  test('should tokenize negative floats', () => {
    const values = getTokenValues('-3.14 -0.5');
    expect(values).toEqual([-3.14, -0.5]);
  });
  test('should tokenize explicit positive numbers', () => {
    const values = getTokenValues('+123 +0.5');
    expect(values).toEqual([123, 0.5]);
  });
  test('should handle numbers adjacent to special characters', () => {
    const values = getTokenValues('{-345}');
    expect(values).toEqual(['{', -345, '}']);
  });

  test('should tokenize words like swap and drop', () => {
    const tokens = getAllTokens('swap drop');
    expect(tokens.length).toBe(2);
    expect(tokens[0]).toEqual(
      expect.objectContaining({
        type: TokenType.WORD,
        value: 'swap',
      }),
    );

    expect(tokens[1]).toEqual(
      expect.objectContaining({
        type: TokenType.WORD,
        value: 'drop',
      }),
    );
  });
  test('should tokenize mixed input with numbers and words', () => {
    const values = getTokenValues('5 dup 3.14 swap');
    expect(values).toEqual([5, 'dup', 3.14, 'swap']);
  });

  test('should tokenize special characters', () => {
    const tokens = getAllTokens('{ } ( ) + - * /');
    expect(tokens.length).toBe(8);
    expect(tokens[0].type).toBe(TokenType.BLOCK_START);
    expect(tokens[0].value).toBe('{');
    expect(tokens[1].type).toBe(TokenType.BLOCK_END);
    expect(tokens[1].value).toBe('}');
    expect(tokens[2].type).toBe(TokenType.SPECIAL);
    expect(tokens[2].value).toBe('(');
    expect(tokens[3].type).toBe(TokenType.SPECIAL);
    expect(tokens[3].value).toBe(')');
    expect(tokens[4].type).toBe(TokenType.WORD);
    expect(tokens[4].value).toBe('+');
  });
  test('should handle standalone operators', () => {
    const values = getTokenValues('5 add 3 sub 2');
    expect(values).toEqual([5, 'add', 3, 'sub', 2]);
  });

  test('should skip empty lines', () => {
    const values = getTokenValues('\n\n5 3 add\n\n');
    expect(values).toEqual([5, 3, 'add']);
  });
  test('should skip lines with only comments', () => {
    const values = getTokenValues('\\ Comment 1\n\\ Comment 2\n5 3 add');
    expect(values).toEqual([5, 3, 'add']);
  });
  test('should skip inline comments', () => {
    const values = getTokenValues('5 3 add \\ This is a comment');
    expect(values).toEqual([5, 3, 'add']);
  });
  test('should handle multiple spaces and empty words', () => {
    const values = getTokenValues('5   3   add');
    expect(values).toEqual([5, 3, 'add']);
  });
  test('should handle mixed input with numbers, words, and special characters', () => {
    const values = getTokenValues('{-345} swap drop 42.5 add');
    expect(values).toEqual(['{', -345, '}', 'swap', 'drop', 42.5, 'add']);
  });
  test('should handle multiple lines with mixed content', () => {
    const values = getTokenValues('5 3 add\n\\ Comment\n10 20 sub\nswap');
    expect(values).toEqual([5, 3, 'add', 10, 20, 'sub', 'swap']);
  });
  test('should handle empty input', () => {
    const tokenizer = new Tokenizer('');
    expect(tokenizer.nextToken().type).toBe(TokenType.EOF);
  });

  test('should tokenize complex expressions', () => {
    const values = getTokenValues('5 dup { 3 add } drop');
    expect(values).toEqual([5, 'dup', '{', 3, 'add', '}', 'drop']);
  });
  test('should handle nested expressions', () => {
    const values = getTokenValues('{ { 5 } { 3 } add }');
    expect(values).toEqual(['{', '{', 5, '}', '{', 3, '}', 'add', '}']);
  });

  test('should handle numbers with leading zeros', () => {
    const values = getTokenValues('007 00.5');
    expect(values).toEqual([7, 0.5]);
  });

  test('should handle words with mixed case', () => {
    const values = getTokenValues('Swap DROP');
    expect(values).toEqual(['Swap', 'DROP']);
  });
  test('should handle { and } as symbol terminators', () => {
    const tokens = getAllTokens('xy{ 123 }z');
    expect(tokens).toHaveLength(5);
    expect(tokens[0]).toEqual(expect.objectContaining({ type: TokenType.WORD, value: 'xy' }));
    expect(tokens[1]).toEqual(expect.objectContaining({ type: TokenType.BLOCK_START, value: '{' }));
    expect(tokens[2]).toEqual(expect.objectContaining({ type: TokenType.NUMBER, value: 123 }));
    expect(tokens[3]).toEqual(expect.objectContaining({ type: TokenType.BLOCK_END, value: '}' }));
    expect(tokens[4]).toEqual(expect.objectContaining({ type: TokenType.WORD, value: 'z' }));
  });
  test('should handle { and } in complex expressions', () => {
    const tokens = getAllTokens('if { x 1 add } { y 2 mul } then');
    const types = tokens.map(t => t.type);
    const values = tokens.map(t => t.value);
    expect(types).toContain(TokenType.BLOCK_START);
    expect(types).toContain(TokenType.BLOCK_END);
    expect(types).toContain(TokenType.WORD);
    expect(types).toContain(TokenType.NUMBER);
    expect(values).toEqual(['if', '{', 'x', 1, 'add', '}', '{', 'y', 2, 'mul', '}', 'then']);
  });
  test('should handle ( and ) as symbol terminators', () => {
    const tokens = getAllTokens('xy( 123 )z');
    expect(tokens).toHaveLength(5);
    expect(tokens[0]).toEqual(expect.objectContaining({ type: TokenType.WORD, value: 'xy' }));
    expect(tokens[1]).toEqual(expect.objectContaining({ type: TokenType.SPECIAL, value: '(' }));
    expect(tokens[2]).toEqual(expect.objectContaining({ type: TokenType.NUMBER, value: 123 }));
    expect(tokens[3]).toEqual(expect.objectContaining({ type: TokenType.SPECIAL, value: ')' }));
    expect(tokens[4]).toEqual(expect.objectContaining({ type: TokenType.WORD, value: 'z' }));
  });
  test('should handle ( and ) in complex expressions', () => {
    const tokens = getAllTokens('if (x 1 add) (y 2 mul) then');
    const types = tokens.map(t => t.type);
    const values = tokens.map(t => t.value);
    expect(types).toContain(TokenType.SPECIAL);
    expect(types).toContain(TokenType.WORD);
    expect(types).toContain(TokenType.NUMBER);
    expect(values).toEqual(['if', '(', 'x', 1, 'add', ')', '(', 'y', 2, 'mul', ')', 'then']);
  });
  test('should handle [ and ] as symbol terminators', () => {
    const tokens = getAllTokens('xy[ 123 ]z');
    expect(tokens).toHaveLength(5);
    expect(tokens[0]).toEqual(expect.objectContaining({ type: TokenType.WORD, value: 'xy' }));
    expect(tokens[1]).toEqual(expect.objectContaining({ type: TokenType.SPECIAL, value: '[' }));
    expect(tokens[2]).toEqual(expect.objectContaining({ type: TokenType.NUMBER, value: 123 }));
    expect(tokens[3]).toEqual(expect.objectContaining({ type: TokenType.SPECIAL, value: ']' }));
    expect(tokens[4]).toEqual(expect.objectContaining({ type: TokenType.WORD, value: 'z' }));
  });
  test('should handle [ and ] in complex expressions', () => {
    const tokens = getAllTokens('array [1 2 add] [3 4 mul] then');
    const types = tokens.map(t => t.type);
    const values = tokens.map(t => t.value);
    expect(types).toContain(TokenType.SPECIAL);
    expect(types).toContain(TokenType.WORD);
    expect(types).toContain(TokenType.NUMBER);
    expect(values).toEqual(['array', '[', 1, 2, 'add', ']', '[', 3, 4, 'mul', ']', 'then']);
  });
  test('should handle words with underscores', () => {
    const values = getTokenValues('my_word another_word');
    expect(values).toEqual(['my_word', 'another_word']);
  });

  test('should handle multiple special characters in a row', () => {
    const values = getTokenValues('{{}}');
    expect(values).toEqual(['{', '{', '}', '}']);
  });

  test('should track token positions correctly', () => {
    const tokens = getAllTokens('5 hello');
    expect(tokens[0].position).toBe(0);
    expect(tokens[1].position).toBe(2);
  });

  test('should track line and column numbers', () => {
    const tokenizer = new Tokenizer('hello\nworld');
    const token1 = tokenizer.nextToken();
    const token2 = tokenizer.nextToken();
    expect(tokenizer.getPosition().line).toBe(2);
    expect(token1.value).toBe('hello');
    expect(token2.value).toBe('world');
  });

  test('should allow pushing back a token', () => {
    const tokenizer = new Tokenizer('5 10');
    const token1 = tokenizer.nextToken();
    expect(token1.value).toBe(5);
    tokenizer.pushBack(token1);
    const token1Again = tokenizer.nextToken();
    const token2 = tokenizer.nextToken();
    expect(token1Again.value).toBe(5);
    expect(token2.value).toBe(10);
  });
  test('should throw error when pushing back multiple tokens', () => {
    const tokenizer = new Tokenizer('5 10');
    const token1 = tokenizer.nextToken();
    const token2 = tokenizer.nextToken();
    tokenizer.pushBack(token2);
    expect(() => tokenizer.pushBack(token1)).toThrow('Cannot push back more than one token');
  });

  test('should tokenize string literals', () => {
    const tokens = getAllTokens('"Hello world"');
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.STRING);
    expect(tokens[0].value).toBe('Hello world');
  });
  test('should handle escaped characters in strings', () => {
    const tokens = getAllTokens('"Hello\\nWorld\\t\\"Escaped\\"\\r\\\\"');
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.STRING);
    expect(tokens[0].value).toBe('Hello\nWorld\t"Escaped"\r\\');
  });
  test('should throw error for unterminated string', () => {
    expect(() => {
      const tokenizer = new Tokenizer('"Unterminated string');
      while (tokenizer.nextToken().type !== TokenType.EOF) {
        /* empty */
      }
    }).toThrow('Unterminated string literal');
  });
  test('should handle mixed strings and other tokens', () => {
    const values = getTokenValues('5 "hello" add');
    expect(values).toEqual([5, 'hello', 'add']);
  });
  test('should handle special characters inside strings', () => {
    const tokens = getAllTokens('"hello { } [ ] ( ) : ; \\" \\\\ there"');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe(TokenType.STRING);
    expect(tokens[0].value).toBe('hello { } [ ] ( ) : ; " \\ there');
  });
  test('should handle empty strings', () => {
    const tokens = getAllTokens('""');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe(TokenType.STRING);
    expect(tokens[0].value).toBe('');
  });
  test('should handle strings with escaped characters', () => {
    const tokens = getAllTokens('"line1\\nline2\\ttab\\"quote\\\\backslash"');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe(TokenType.STRING);
    expect(tokens[0].value).toBe('line1\nline2\ttab"quote\\backslash');
  });
  test('should handle strings at the end of input', () => {
    const tokens = getAllTokens('42 "the end"');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].type).toBe(TokenType.NUMBER);
    expect(tokens[0].value).toBe(42);
    expect(tokens[1].type).toBe(TokenType.STRING);
    expect(tokens[1].value).toBe('the end');
  });
});
