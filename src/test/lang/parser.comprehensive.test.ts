import { Op } from '../../ops/opcodes';
import { createVM, VM, digestGet } from '../../core';
import { parse } from '../../lang/parser';
import { createTokenizer } from '../../lang/tokenizer';
import { executeProgram } from '../../lang/runner';
import { next8, nextInt16, nextFloat32, resolveSymbol, pop } from '../../core/vm';

describe('Comprehensive Parser Tests', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });
  describe('Error Handling', () => {
    test('should throw on unclosed definition', () => {
      expect(() => parse(vm, createTokenizer(': test'))).toThrow('Unclosed definition for test');
    });
    test('should throw on nested definitions', () => {
      expect(() => parse(vm, createTokenizer(': test : nested ;'))).toThrow(
        'Cannot nest definition inside code block',
      );
    });
    test('should throw on definition without name', () => {
      expect(() => parse(vm, createTokenizer(': ;'))).toThrow('Expected word name after :');
    });
    test('should throw on unexpected closing parenthesis', () => {
      expect(() => parse(vm, createTokenizer(')'))).toThrow('Unexpected closing parenthesis');
    });
  });
  describe('Word Definitions', () => {
    test('should handle empty word definitions', () => {
      const nextNonNop = () => {
        let op = next8(vm);
        while (op === Op.Nop) {
          op = next8(vm);
        }
        return op;
      };
      parse(vm, createTokenizer(': empty ;'));
      const emptyWord = resolveSymbol(vm, 'empty');
      expect(emptyWord).toBeDefined();
      vm.ip = 0;
      expect(next8(vm)).toBe(Op.Branch);
      nextInt16(vm);
      expect(nextNonNop()).toBe(Op.Exit);
    });
    test('should handle words with special characters in name', () => {
      parse(vm, createTokenizer(': test-word! add sub ;'));
      expect(resolveSymbol(vm, 'test-word!')).toBeDefined();
    });
    test('should handle word names that start with numbers', () => {
      vm.ip = 0;
      executeProgram(vm, ': 2x 2 mul ; 5 2x');
      expect(pop(vm)).toBe(10);
    });
  });
  describe('Lists', () => {
    test('should parse empty lists', () => {
      parse(vm, createTokenizer('( )'));
      vm.ip = 0;
      expect(next8(vm)).toBe(Op.OpenList);
      expect(next8(vm)).toBe(Op.CloseList);
    });
    test('should parse lists with elements', () => {
      parse(vm, createTokenizer('( 1 2 )'));
      vm.ip = 0;
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
      parse(vm, createTokenizer('1 if 2 else 3 ;'));
      vm.ip = 0;
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
      parse(vm, createTokenizer('""'));
      vm.ip = 0;
      expect(next8(vm)).toBe(Op.LiteralString);
      const addr = nextInt16(vm);
      expect(addr).toBeGreaterThan(0);
      const str = digestGet(vm.compile.digest, addr);
      expect(str).toBe('');
    });
    test('should parse string literals with spaces', () => {
      parse(vm, createTokenizer('"hello world"'));
      vm.ip = 0;
      expect(next8(vm)).toBe(Op.LiteralString);
      const addr = nextInt16(vm);
      const str = digestGet(vm.compile.digest, addr);
      expect(str).toBe('hello world');
    });
  });
  describe('Bare String Shorthand', () => {
    test("should parse 'key as a string literal", () => {
      // parse only the apostrophe shorthand
      parse(vm, createTokenizer("'test-symbol"));
      vm.ip = 0;
      expect(next8(vm)).toBe(Op.LiteralString);
      const addr = nextInt16(vm);
      const str = digestGet(vm.compile.digest, addr);
      expect(str).toBe('test-symbol');
    });
  });
});
