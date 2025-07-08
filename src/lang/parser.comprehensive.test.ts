import { Op } from '../ops/opcodes';
import { initializeInterpreter, vm } from '../core/globalState';
import { parse } from './parser';
import { Tokenizer } from './tokenizer';
import { executeProgram } from './interpreter';
describe('Comprehensive Parser Tests', () => {
  beforeEach(() => {
    initializeInterpreter();
  });
  describe('Error Handling', () => {
    it('should throw on unclosed definition', () => {
      expect(() => parse(new Tokenizer(': test'))).toThrow('Unclosed definition for test');
    });
    it('should throw on nested definitions', () => {
      expect(() => parse(new Tokenizer(': test : nested ;'))).toThrow(
        'Nested definitions are not allowed'
      );
    });
    it('should throw on definition without name', () => {
      expect(() => parse(new Tokenizer(': ;'))).toThrow('Expected word name after :');
    });
    it('should throw on unexpected closing parenthesis', () => {
      expect(() => parse(new Tokenizer(')'))).toThrow('Unexpected closing parenthesis');
    });
  });
  describe('Word Definitions', () => {
    it('should handle empty word definitions', () => {
      parse(new Tokenizer(': empty ;'));
      const emptyWord = vm.symbolTable.find('empty');
      expect(emptyWord).toBeDefined();

      vm.reset();
      expect(vm.next8()).toBe(Op.Branch);
      const _skipOffset = vm.next16();
      expect(vm.next8()).toBe(Op.Exit);
    });
    it('should handle words with special characters in name', () => {
      parse(new Tokenizer(': test-word! add sub ;'));
      expect(vm.symbolTable.find('test-word!')).toBeDefined();
    });
    it('should handle word names that start with numbers', () => {
      vm.reset();

      executeProgram(': 2x 2 mul ; 5 2x');

      expect(vm.pop()).toBe(10);
    });
    it('should not allow redefining words', () => {
      parse(new Tokenizer(': test 1 ;'));
      expect(() => parse(new Tokenizer(': test 2 ;'))).toThrow('Word already defined: test');
    });
  });
  describe('Tuples', () => {
    it('should parse empty tuples', () => {
      parse(new Tokenizer('( )'));
      vm.reset();
      expect(vm.next8()).toBe(Op.OpenTuple);
      expect(vm.next8()).toBe(Op.CloseTuple);
    });
    it('should parse tuples with elements', () => {
      parse(new Tokenizer('( 1 2 )'));
      vm.reset();
      expect(vm.next8()).toBe(Op.OpenTuple);
      expect(vm.next8()).toBe(Op.LiteralNumber);
      expect(vm.nextFloat32()).toBe(1);
      expect(vm.next8()).toBe(Op.LiteralNumber);
      expect(vm.nextFloat32()).toBe(2);
      expect(vm.next8()).toBe(Op.CloseTuple);
    });
  });
  describe('Control Structures', () => {
    it('should parse IF-ELSE-THEN', () => {
      parse(new Tokenizer('IF { 1 } ELSE { 2 }'));

      vm.reset();

      expect(vm.next8()).toBe(Op.IfFalseBranch);
      const _falseJumpAddr = vm.next16();

      expect(vm.next8()).toBe(Op.LiteralNumber);
      expect(vm.nextFloat32()).toBe(1);

      expect(vm.next8()).toBe(Op.Branch);
      const _endIfAddr = vm.next16();

      expect(vm.next8()).toBe(Op.LiteralNumber);
      expect(vm.nextFloat32()).toBe(2);

      expect(vm.next8()).toBe(Op.Abort);
    });
  });
  describe('String Literals', () => {
    it('should parse empty string literals', () => {
      parse(new Tokenizer('""'));
      vm.reset();
      expect(vm.next8()).toBe(Op.LiteralString);
      const addr = vm.next16();
      expect(addr).toBeGreaterThan(0);

      const str = vm.digest.get(addr);
      expect(str).toBe('');
    });
    it('should parse string literals with spaces', () => {
      parse(new Tokenizer('"hello world"'));
      vm.reset();
      expect(vm.next8()).toBe(Op.LiteralString);
      const addr = vm.next16();
      const str = vm.digest.get(addr);
      expect(str).toBe('hello world');
    });
  });
  describe('Symbol Literals', () => {
    it('should parse symbol literals', () => {
      parse(new Tokenizer(': test-symbol 42 ;'));

      parse(new Tokenizer('`test-symbol'));

      vm.reset();
      expect(vm.next8()).toBe(1);
      const _addr = vm.next16();
    });
  });
});
