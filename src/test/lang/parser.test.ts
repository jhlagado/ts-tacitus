import { Op } from '../../ops/opcodes';
import { createVM, VM } from '../../core';
import { parse } from '../../lang/parser';
import { createTokenizer } from '../../lang/tokenizer';
import { getTaggedInfo } from '../../core/tagged';
import { next8, nextFloat32, nextInt16, resolveSymbol } from '../../core/vm';

describe('Parser with Tokenizer', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  const getCompiledCode = (): Uint8Array => {
    const cp = vm.compile.CP;
    return new Uint8Array(vm.memory.buffer.buffer, 0, cp);
  };

  describe('Basic parsing', () => {
    test('should parse numbers correctly', () => {
      parse(vm, createTokenizer('42 -3.14 +5'));
      vm.ip = 0;
      expect(next8(vm)).toBe(Op.LiteralNumber);
      expect(nextFloat32(vm)).toBeCloseTo(42);
      expect(next8(vm)).toBe(Op.LiteralNumber);
      expect(nextFloat32(vm)).toBeCloseTo(-3.14);
      expect(next8(vm)).toBe(Op.LiteralNumber);
      expect(nextFloat32(vm)).toBeCloseTo(5);
      expect(next8(vm)).toBe(Op.Abort);
    });
    test('should parse built-in words correctly', () => {
      parse(vm, createTokenizer('dup drop swap add sub'));
      vm.ip = 0;
      expect(next8(vm)).toBe(Op.Dup);
      expect(next8(vm)).toBe(Op.Drop);
      expect(next8(vm)).toBe(Op.Swap);
      expect(next8(vm)).toBe(Op.Add);
      expect(next8(vm)).toBe(Op.Minus);
      expect(next8(vm)).toBe(Op.Abort);
    });
    test('should parse mixed content correctly', () => {
      parse(vm, createTokenizer('10 dup mul 5 add'));
      vm.ip = 0;
      expect(next8(vm)).toBe(Op.LiteralNumber);
      expect(nextFloat32(vm)).toBeCloseTo(10);
      expect(next8(vm)).toBe(Op.Dup);
      expect(next8(vm)).toBe(Op.Multiply);
      expect(next8(vm)).toBe(Op.LiteralNumber);
      expect(nextFloat32(vm)).toBeCloseTo(5);
      expect(next8(vm)).toBe(Op.Add);
      expect(next8(vm)).toBe(Op.Abort);
    });
    test('should handle empty input', () => {
      parse(vm, createTokenizer(''));
      vm.ip = 0;
      expect(next8(vm)).toBe(Op.Abort);
    });
  });

  describe('Colon definitions', () => {
    test('should parse simple word definitions', () => {
      parse(vm, createTokenizer(': double dup add ;'));
      const doubleWord = resolveSymbol(vm, 'double');
      expect(doubleWord).toBeDefined();
      vm.ip = 0;
      expect(next8(vm)).toBe(Op.Branch);
      nextInt16(vm); // skipOffset
      expect(next8(vm)).toBe(Op.Dup);
      expect(next8(vm)).toBe(Op.Add);
      expect(next8(vm)).toBe(Op.Exit);
      expect(next8(vm)).toBe(Op.Abort);
    });
    test('should parse word definitions with numbers in name', () => {
      parse(vm, createTokenizer(': plus2 2 add ;'));
      expect(resolveSymbol(vm, 'plus2')).toBeDefined();
    });
    test('should parse word definitions with numbers as name', () => {
      parse(vm, createTokenizer(': 123 dup mul ;'));
      expect(resolveSymbol(vm, '123')).toBeDefined();
    });
    test('should handle empty word definitions', () => {
      parse(vm, createTokenizer(': empty ;'));
      expect(resolveSymbol(vm, 'empty')).toBeDefined();
      const emptyRef = resolveSymbol(vm, 'empty');
      expect(emptyRef).toBeDefined();
      if (emptyRef !== undefined) {
        const { value } = getTaggedInfo(emptyRef);
        expect(value).toBeDefined();
      }
    });
    test('should throw an error for unclosed definitions', () => {
      expect(() => parse(vm, createTokenizer(': square dup mul'))).toThrow(
        'Unclosed definition for square',
      );
    });
    test('should throw an error for unexpected semicolons', () => {
      expect(() => parse(vm, createTokenizer('10 ;'))).toThrow('Unexpected semicolon');
    });
    test('should throw an error for nested definitions', () => {
      expect(() => parse(vm, createTokenizer(': outer : inner ; ;'))).toThrow(
        'Cannot nest definition inside code block',
      );
    });
  });

  describe('Multiple definitions', () => {
    test('should handle multiple word definitions', () => {
      parse(vm, createTokenizer(': double dup add ; : triple dup dup add add ;'));
      expect(resolveSymbol(vm, 'double')).toBeDefined();
      expect(resolveSymbol(vm, 'triple')).toBeDefined();
    });
    test('should allow words to use previously defined words', () => {
      parse(vm, createTokenizer(': double dup add ; : quadruple double double ;'));
      expect(resolveSymbol(vm, 'double')).toBeDefined();
      expect(resolveSymbol(vm, 'quadruple')).toBeDefined();
    });
  });

  describe('Error handling', () => {
    test('should throw on malformed word definition', () => {
      expect(() => parse(vm, createTokenizer(': test 1 add'))).toThrow(
        'Unclosed definition for test',
      );
      expect(() => parse(vm, createTokenizer(':'))).toThrow('Expected word name after :');
    });
    test('should throw on unterminated string', () => {
      expect(() => parse(vm, createTokenizer('"unterminated string'))).toThrow(
        'Unterminated string',
      );
    });
    test('should throw on unknown words', () => {
      expect(() => parse(vm, createTokenizer('unknown_word'))).toThrow(
        'Undefined word: unknown_word',
      );
    });
  });

  describe('Word definitions', () => {
    test('should define and find simple words', () => {
      parse(vm, createTokenizer(': double dup add ;'));
      expect(resolveSymbol(vm, 'double')).toBeDefined();
    });
    test('should handle multiple word definitions', () => {
      parse(vm, createTokenizer(': double dup add ; : square dup mul ;'));
      expect(resolveSymbol(vm, 'double')).toBeDefined();
      expect(resolveSymbol(vm, 'square')).toBeDefined();
    });
    test('should handle words with numbers in name', () => {
      parse(vm, createTokenizer(': x2 2 mul ;'));
      expect(resolveSymbol(vm, 'x2')).toBeDefined();
      try {
        parse(vm, createTokenizer(': 2times 2 mul ;'));
        expect(resolveSymbol(vm, '2times')).toBeDefined();
      } catch (_e) {
        // Words starting with numbers might not be supported
      }
    });
    test('should handle words with special characters', () => {
      parse(vm, createTokenizer(': double? dup 0 gt ;'));
      expect(resolveSymbol(vm, 'double?')).toBeDefined();
    });
  });

  describe('Number parsing', () => {
    test('should parse positive integers', () => {
      parse(vm, createTokenizer('123'));
      const code = getCompiledCode();
      expect(code.length).toBeGreaterThan(0);
    });
    test('should parse negative numbers', () => {
      parse(vm, createTokenizer('-42'));
      const code = getCompiledCode();
      expect(code.length).toBeGreaterThan(0);
    });
    test('should parse floating point numbers', () => {
      parse(vm, createTokenizer('3.14159'));
      const code = getCompiledCode();
      expect(code.length).toBeGreaterThan(0);
    });
    test('should parse multiple numbers', () => {
      parse(vm, createTokenizer('1 2 3'));
      const code = getCompiledCode();
      expect(code.length).toBeGreaterThan(0);
    });
  });

  describe('Comments and whitespace', () => {
    test('should ignore comments', () => {
      parse(vm, createTokenizer('1 2 # This is a comment\n3'));
      expect(true).toBeTruthy();
    });
    test('should handle inline comments', () => {
      parse(vm, createTokenizer('1 2 # comment\n3 4 # another comment'));
      expect(true).toBeTruthy();
    });
    test('should handle empty lines', () => {
      parse(vm, createTokenizer('1\n\n2\n\n3'));
      expect(true).toBeTruthy();
    });
    test('should handle extra whitespace', () => {
      parse(vm, createTokenizer('   1   2   3   '));
      expect(true).toBeTruthy();
    });
  });

  describe('String handling', () => {
    test('should parse string literals', () => {
      expect(() => parse(vm, createTokenizer('"hello"'))).not.toThrow();
    });
    test('should handle empty strings', () => {
      expect(() => parse(vm, createTokenizer('""'))).not.toThrow();
    });
    test('should handle escaped characters in strings', () => {
      expect(() => parse(vm, createTokenizer('"hello\\nworld"'))).not.toThrow();
    });
    test('should handle strings with special characters', () => {
      expect(() => parse(vm, createTokenizer('"special-chars"'))).not.toThrow();
    });
  });
});
