import { Op } from '../../ops/opcodes';
import { initializeInterpreter, vm } from '../../lang/runtime';
import { parse } from '../../lang/parser';
import { Tokenizer } from '../../lang/tokenizer';
import { executeProgram } from '../../lang/interpreter';
import { next8, nextInt16, nextFloat32 } from '../../core/vm';

describe('Comprehensive Parser Tests', () => {
  beforeEach(() => {
    initializeInterpreter();
  });
  describe('Error Handling', () => {
    test('should throw on unclosed definition', () => {
      expect(() => parse(new Tokenizer(': test'))).toThrow('Unclosed definition for test');
    });
    test('should throw on nested definitions', () => {
      expect(() => parse(new Tokenizer(': test : nested ;'))).toThrow(
        'Cannot nest definition inside code block',
      );
    });
    test('should throw on definition without name', () => {
      expect(() => parse(new Tokenizer(': ;'))).toThrow('Expected word name after :');
    });
    test('should throw on unexpected closing parenthesis', () => {
      expect(() => parse(new Tokenizer(')'))).toThrow('Unexpected closing parenthesis');
    });
  });
  describe('Word Definitions', () => {
    test('should handle empty word definitions', () => {
      parse(new Tokenizer(': empty ;'));
      const emptyWord = vm.resolveSymbol('empty');
      expect(emptyWord).toBeDefined();
      vm.IP = 0;
      expect(next8(vm)).toBe(Op.Branch);
      nextInt16(vm);
      expect(next8(vm)).toBe(Op.Exit);
    });
    test('should handle words with special characters in name', () => {
      parse(new Tokenizer(': test-word! add sub ;'));
      expect(vm.resolveSymbol('test-word!')).toBeDefined();
    });
    test('should handle word names that start with numbers', () => {
      vm.IP = 0;
      executeProgram(': 2x 2 mul ; 5 2x');
      expect(vm.pop()).toBe(10);
    });
  });
  describe('Lists', () => {
    test('should parse empty lists', () => {
      parse(new Tokenizer('( )'));
      vm.IP = 0;
      expect(next8(vm)).toBe(Op.OpenList);
      expect(next8(vm)).toBe(Op.CloseList);
    });
    test('should parse lists with elements', () => {
      parse(new Tokenizer('( 1 2 )'));
      vm.IP = 0;
      expect(next8(vm)).toBe(Op.OpenList);
      expect(next8(vm)).toBe(Op.LiteralNumber);
      expect(nextFloat32(vm)).toBe(1);
      expect(next8(vm)).toBe(Op.LiteralNumber);
      expect(nextFloat32(vm)).toBe(2);
      expect(next8(vm)).toBe(Op.CloseList);
    });
  });
  describe('Control Structures', () => {
    test('should parse IF-ELSE-THEN', () => {
      parse(new Tokenizer('1 if 2 else 3 ;'));
      vm.IP = 0;
      expect(next8(vm)).toBe(Op.LiteralNumber);
      expect(nextFloat32(vm)).toBe(1);
      expect(next8(vm)).toBe(Op.IfFalseBranch);
      nextInt16(vm);
      expect(next8(vm)).toBe(Op.LiteralNumber);
      expect(nextFloat32(vm)).toBe(2);
      expect(next8(vm)).toBe(Op.Branch);
      nextInt16(vm);
      expect(next8(vm)).toBe(Op.LiteralNumber);
      expect(nextFloat32(vm)).toBe(3);
      expect(next8(vm)).toBe(Op.Abort);
    });
  });
  describe('String Literals', () => {
    test('should parse empty string literals', () => {
      parse(new Tokenizer('""'));
      vm.IP = 0;
      expect(next8(vm)).toBe(Op.LiteralString);
      const addr = nextInt16(vm);
      expect(addr).toBeGreaterThan(0);
      const str = vm.digest.get(addr);
      expect(str).toBe('');
    });
    test('should parse string literals with spaces', () => {
      parse(new Tokenizer('"hello world"'));
      vm.IP = 0;
      expect(next8(vm)).toBe(Op.LiteralString);
      const addr = nextInt16(vm);
      const str = vm.digest.get(addr);
      expect(str).toBe('hello world');
    });
  });
  describe('Bare String Shorthand', () => {
    test("should parse 'key as a string literal", () => {
      // parse only the apostrophe shorthand
      parse(new Tokenizer("'test-symbol"));
      vm.IP = 0;
      expect(next8(vm)).toBe(Op.LiteralString);
      const addr = nextInt16(vm);
      const str = vm.digest.get(addr);
      expect(str).toBe('test-symbol');
    });
  });
});
