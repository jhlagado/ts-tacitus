import { Op } from '../ops/opcodes';
import { initializeInterpreter, vm } from '../core/globalState';
import { parse } from './parser';
import { Tokenizer } from './tokenizer';

describe('Comprehensive Parser Tests', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  describe('Error Handling', () => {
    it('should throw on unclosed definition', () => {
      expect(() => parse(new Tokenizer(': test'))).toThrow('Unclosed definition for test');
    });

    it('should throw on nested definitions', () => {
      expect(() => parse(new Tokenizer(': test : nested ;'))).toThrow('Nested definitions are not allowed');
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
      
      // Should just contain EXIT opcode
      vm.reset();
      expect(vm.next8()).toBe(Op.Branch);
      const _skipOffset = vm.next16();
      expect(vm.next8()).toBe(Op.Exit);
    });

    it('should handle words with special characters in name', () => {
      parse(new Tokenizer(': test-word! + - ;'));
      expect(vm.symbolTable.find('test-word!')).toBeDefined();
    });

    it('should not allow redefining words', () => {
      parse(new Tokenizer(': test 1 ;'));
      expect(() => parse(new Tokenizer(': test 2 ;'))).toThrow('Word already defined: test');
    });
  });

  describe('Code Blocks', () => {
    it('should parse empty code blocks', () => {
      parse(new Tokenizer('( )'));
      // Should compile to BRANCH_CALL <offset> EXIT
      vm.reset();
      expect(vm.next8()).toBe(Op.BranchCall);
      const offset = vm.next16();
      expect(offset).toBe(1); // Just the EXIT opcode
      expect(vm.next8()).toBe(Op.Exit);
    });

    it('should parse nested code blocks', () => {
      parse(new Tokenizer('( ( 1 2 + ) )'));
      // Outer block
      vm.reset();
      expect(vm.next8()).toBe(Op.BranchCall);
      const _outerOffset = vm.next16();
      
      // Inner block
      expect(vm.next8()).toBe(Op.BranchCall);
      const _innerOffset = vm.next16();
      expect(vm.next8()).toBe(Op.LiteralNumber);
      expect(vm.nextFloat32()).toBe(1);
      expect(vm.next8()).toBe(Op.LiteralNumber);
      expect(vm.nextFloat32()).toBe(2);
      expect(vm.next8()).toBe(Op.Plus);
      expect(vm.next8()).toBe(Op.Exit);
      
      // Outer block continues
      expect(vm.next8()).toBe(Op.Exit);
    });
  });

  describe('Control Structures', () => {
    it('should parse IF-ELSE-THEN', () => {
      parse(new Tokenizer('IF { 1 } ELSE { 2 }'));
      
      // Verify the compiled bytecode structure
      vm.reset();
      
      // IF
      expect(vm.next8()).toBe(Op.IfFalseBranch);
      const _falseJumpAddr = vm.next16();
      
      // TRUE branch (1)
      expect(vm.next8()).toBe(Op.LiteralNumber);
      expect(vm.nextFloat32()).toBe(1);
      
      // Jump over ELSE
      expect(vm.next8()).toBe(Op.Branch);
      const _endIfAddr = vm.next16();
      
      // FALSE branch (2)
      expect(vm.next8()).toBe(Op.LiteralNumber);
      expect(vm.nextFloat32()).toBe(2);
      
      // END IF
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
      
      // Verify the string in the digest
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
      // In Tacit, we can define a word with a symbol name
      // and then use it with the backtick syntax
      parse(new Tokenizer(': test-symbol 42 ;'));
      
      // Now use the symbol
      parse(new Tokenizer('`test-symbol'));
      
      // The symbol should be compiled as a call to the word
      // Note: Op.Call is 1 in the VM
      vm.reset();
      expect(vm.next8()).toBe(1); // Op.Call
      const _addr = vm.next16();
    });
  });
});
