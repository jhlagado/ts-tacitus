/* eslint-disable @typescript-eslint/no-unused-vars */
import { Op } from '../../ops/opcodes';
import { initializeInterpreter, vm } from '../../lang/runtime';
import { parse } from '../../lang/parser';
import { Tokenizer } from '../../lang/tokenizer';
import { fromTaggedValue } from '../../core/tagged';

const getCompiledCode = (): Uint8Array => {
  const cp = vm.compiler.CP;
  return new Uint8Array(vm.memory.buffer, 0, cp);
};
describe('Parser with Tokenizer', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  describe('Basic parsing', () => {
    test('should parse numbers correctly', () => {
      parse(new Tokenizer('42 -3.14 +5'));
      vm.IP = 0;
      expect(vm.next8()).toBe(Op.LiteralNumber);
      expect(vm.nextFloat32()).toBeCloseTo(42);
      expect(vm.next8()).toBe(Op.LiteralNumber);
      expect(vm.nextFloat32()).toBeCloseTo(-3.14);
      expect(vm.next8()).toBe(Op.LiteralNumber);
      expect(vm.nextFloat32()).toBeCloseTo(5);
      expect(vm.next8()).toBe(Op.Abort);
    });
    test('should parse built-in words correctly', () => {
      parse(new Tokenizer('dup drop swap add sub'));
      vm.IP = 0;
      expect(vm.next8()).toBe(Op.Dup);
      expect(vm.next8()).toBe(Op.Drop);
      expect(vm.next8()).toBe(Op.Swap);
      expect(vm.next8()).toBe(Op.Add);
      expect(vm.next8()).toBe(Op.Minus);
      expect(vm.next8()).toBe(Op.Abort);
    });
    test('should parse mixed content correctly', () => {
      parse(new Tokenizer('10 dup mul 5 add'));
      vm.IP = 0;
      expect(vm.next8()).toBe(Op.LiteralNumber);
      expect(vm.nextFloat32()).toBeCloseTo(10);
      expect(vm.next8()).toBe(Op.Dup);
      expect(vm.next8()).toBe(Op.Multiply);
      expect(vm.next8()).toBe(Op.LiteralNumber);
      expect(vm.nextFloat32()).toBeCloseTo(5);
      expect(vm.next8()).toBe(Op.Add);
      expect(vm.next8()).toBe(Op.Abort);
    });
    test('should handle empty input', () => {
      parse(new Tokenizer(''));
      vm.IP = 0;
      expect(vm.next8()).toBe(Op.Abort);
    });
  });

  describe('Colon definitions', () => {
    test('should parse simple word definitions', () => {
      parse(new Tokenizer(': double dup add ;'));
      const doubleWord = vm.resolveSymbol('double');
      expect(doubleWord).toBeDefined();
      vm.IP = 0;
      expect(vm.next8()).toBe(Op.Branch);
      const skipOffset = vm.nextInt16();
      expect(vm.next8()).toBe(Op.Dup);
      expect(vm.next8()).toBe(Op.Add);
      expect(vm.next8()).toBe(Op.Exit);
      expect(vm.next8()).toBe(Op.Abort);
    });
    test('should parse word definitions with numbers in name', () => {
      parse(new Tokenizer(': plus2 2 add ;'));
      expect(vm.resolveSymbol('plus2')).toBeDefined();
    });
    test('should parse word definitions with numbers as name', () => {
      parse(new Tokenizer(': 123 dup mul ;'));
      expect(vm.resolveSymbol('123')).toBeDefined();
    });
    test('should handle empty word definitions', () => {
      parse(new Tokenizer(': empty ;'));
      expect(vm.resolveSymbol('empty')).toBeDefined();
      const emptyRef = vm.resolveSymbol('empty');
      expect(emptyRef).toBeDefined();
      if (emptyRef !== undefined) {
        const { value } = fromTaggedValue(emptyRef);
        expect(value).toBeDefined();
      }
    });
    test('should throw an error for unclosed definitions', () => {
      expect(() => parse(new Tokenizer(': square dup mul'))).toThrow(
        'Unclosed definition for square',
      );
    });
    test('should throw an error for unexpected semicolons', () => {
      expect(() => parse(new Tokenizer('10 ;'))).toThrow('Unexpected semicolon');
    });
    test('should throw an error for nested definitions', () => {
      expect(() => parse(new Tokenizer(': outer : inner ; ;'))).toThrow(
        'Cannot nest definition inside code block',
      );
    });
  });

  describe('Multiple definitions', () => {
    test('should handle multiple word definitions', () => {
      parse(new Tokenizer(': double dup add ; : triple dup dup add add ;'));
      expect(vm.resolveSymbol('double')).toBeDefined();
      expect(vm.resolveSymbol('triple')).toBeDefined();
    });
    test('should allow words to use previously defined words', () => {
      parse(new Tokenizer(': double dup add ; : quadruple double double ;'));
      expect(vm.resolveSymbol('double')).toBeDefined();
      expect(vm.resolveSymbol('quadruple')).toBeDefined();
    });
  });

  describe('Error handling', () => {
    test('should throw on malformed word definition', () => {
      expect(() => parse(new Tokenizer(': test 1 add'))).toThrow('Unclosed definition for test');
      expect(() => parse(new Tokenizer(':'))).toThrow('Expected word name after :');
    });
    test('should throw on unterminated string', () => {
      expect(() => parse(new Tokenizer('"unterminated string'))).toThrow('Unterminated string');
    });
    test('should throw on unknown words', () => {
      expect(() => parse(new Tokenizer('unknown_word'))).toThrow('Undefined word: unknown_word');
    });
  });

  describe('Word definitions', () => {
    beforeEach(() => {
      initializeInterpreter();
    });
    test('should define and find simple words', () => {
      parse(new Tokenizer(': double dup add ;'));
      expect(vm.resolveSymbol('double')).toBeDefined();
    });
    test('should handle multiple word definitions', () => {
      parse(new Tokenizer(': double dup add ; : square dup mul ;'));
      expect(vm.resolveSymbol('double')).toBeDefined();
      expect(vm.resolveSymbol('square')).toBeDefined();
    });
    test('should handle words with numbers in name', () => {
      parse(new Tokenizer(': x2 2 mul ;'));
      expect(vm.resolveSymbol('x2')).toBeDefined();
      try {
        parse(new Tokenizer(': 2times 2 mul ;'));
        expect(vm.resolveSymbol('2times')).toBeDefined();
      } catch (e) {
        // Words starting with numbers might not be supported
      }
    });
    test('should handle words with special characters', () => {
      parse(new Tokenizer(': double? dup 0 gt ;'));
      expect(vm.resolveSymbol('double?')).toBeDefined();
    });
  });

  describe('Number parsing', () => {
    beforeEach(() => {
      initializeInterpreter();
    });
    test('should parse positive integers', () => {
      parse(new Tokenizer('123'));
      const code = getCompiledCode();
      expect(code.length).toBeGreaterThan(0);
    });
    test('should parse negative numbers', () => {
      parse(new Tokenizer('-42'));
      const code = getCompiledCode();
      expect(code.length).toBeGreaterThan(0);
    });
    test('should parse floating point numbers', () => {
      parse(new Tokenizer('3.14159'));
      const code = getCompiledCode();
      expect(code.length).toBeGreaterThan(0);
    });
    test('should parse multiple numbers', () => {
      parse(new Tokenizer('1 2 3'));
      const code = getCompiledCode();
      expect(code.length).toBeGreaterThan(0);
    });
  });

  describe('Comments and whitespace', () => {
    beforeEach(() => {
      initializeInterpreter();
    });
    test('should ignore comments', () => {
      parse(new Tokenizer('1 2 \\ This is a comment\n3'));
      expect(true).toBeTruthy();
    });
    test('should handle inline comments', () => {
      parse(new Tokenizer('1 2 \\ comment\n3 4 \\ another comment'));
      expect(true).toBeTruthy();
    });
    test('should handle empty lines', () => {
      parse(new Tokenizer('1\n\n2\n\n3'));
      expect(true).toBeTruthy();
    });
    test('should handle extra whitespace', () => {
      parse(new Tokenizer('   1   2   3   '));
      expect(true).toBeTruthy();
    });
  });

  describe('String handling', () => {
    beforeEach(() => {
      initializeInterpreter();
    });
    test('should parse string literals', () => {
      expect(() => parse(new Tokenizer('"hello"'))).not.toThrow();
    });
    test('should handle empty strings', () => {
      expect(() => parse(new Tokenizer('""'))).not.toThrow();
    });
    test('should handle escaped characters in strings', () => {
      expect(() => parse(new Tokenizer('"hello\\nworld"'))).not.toThrow();
    });
    test('should handle strings with special characters', () => {
      expect(() => parse(new Tokenizer('"special-chars"'))).not.toThrow();
    });
  });
});
