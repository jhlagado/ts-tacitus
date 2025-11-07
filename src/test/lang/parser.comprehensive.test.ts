import { Op } from '../../ops/opcodes';
import { initializeInterpreter, vm } from '../../lang/runtime';
import { parse } from '../../lang/parser';
import { Tokenizer } from '../../lang/tokenizer';
import { executeProgram } from '../../lang/interpreter';

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
      expect(vm.next8()).toBe(Op.Branch);
      vm.nextInt16();
      expect(vm.next8()).toBe(Op.Exit);
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
      expect(vm.next8()).toBe(Op.OpenList);
      expect(vm.next8()).toBe(Op.CloseList);
    });
    test('should parse lists with elements', () => {
      parse(new Tokenizer('( 1 2 )'));
      vm.IP = 0;
      expect(vm.next8()).toBe(Op.OpenList);
      expect(vm.next8()).toBe(Op.LiteralNumber);
      expect(vm.nextFloat32()).toBe(1);
      expect(vm.next8()).toBe(Op.LiteralNumber);
      expect(vm.nextFloat32()).toBe(2);
      expect(vm.next8()).toBe(Op.CloseList);
    });
  });
  describe('Control Structures', () => {
    test('should parse IF-ELSE-THEN', () => {
      parse(new Tokenizer('1 if 2 else 3 ;'));
      vm.IP = 0;
      expect(vm.next8()).toBe(Op.LiteralNumber);
      expect(vm.nextFloat32()).toBe(1);
      expect(vm.next8()).toBe(Op.IfFalseBranch);
      vm.nextInt16();
      expect(vm.next8()).toBe(Op.LiteralNumber);
      expect(vm.nextFloat32()).toBe(2);
      expect(vm.next8()).toBe(Op.Branch);
      vm.nextInt16();
      expect(vm.next8()).toBe(Op.LiteralNumber);
      expect(vm.nextFloat32()).toBe(3);
      expect(vm.next8()).toBe(Op.Abort);
    });
  });
  describe('String Literals', () => {
    test('should parse empty string literals', () => {
      parse(new Tokenizer('""'));
      vm.IP = 0;
      expect(vm.next8()).toBe(Op.LiteralString);
      const addr = vm.nextInt16();
      expect(addr).toBeGreaterThan(0);
      const str = vm.digest.get(addr);
      expect(str).toBe('');
    });
    test('should parse string literals with spaces', () => {
      parse(new Tokenizer('"hello world"'));
      vm.IP = 0;
      expect(vm.next8()).toBe(Op.LiteralString);
      const addr = vm.nextInt16();
      const str = vm.digest.get(addr);
      expect(str).toBe('hello world');
    });
  });
  describe('Bare String Shorthand', () => {
    test("should parse 'key as a string literal", () => {
      // parse only the apostrophe shorthand
      parse(new Tokenizer("'test-symbol"));
      vm.IP = 0;
      expect(vm.next8()).toBe(Op.LiteralString);
      const addr = vm.nextInt16();
      const str = vm.digest.get(addr);
      expect(str).toBe('test-symbol');
    });
  });
});
