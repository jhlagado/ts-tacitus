/**
 * @fileoverview Tests for Step 14: @symbol parser/compiler integration.
 *
 * This test suite validates that @symbol syntax works end-to-end in Tacit code:
 * 1. Tokenizer recognizes @symbol (Step 13)
 * 2. Parser compiles @symbol to pushSymbolRef call (Step 14)
 * 3. VM resolves symbol and pushes tagged value (Step 11)
 * 4. eval can execute the resulting tagged value
 *
 * Coverage:
 * - Basic @symbol parsing and execution
 * - Built-in operations (@add, @dup, @swap)
 * - Colon definitions (@square, @double)
 * - Integration with eval for metaprogramming
 * - Error cases and edge conditions
 *
 * @author Tacit VM
 * @version 1.0.0
 */

import { executeTacitCode, resetVM } from '../utils/vm-test-utils';
import { vm } from '../../lang/runtime';
import { Tag, fromTaggedValue } from '../../core';

describe('@symbol Parser/Compiler Integration - Step 14', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('Basic @symbol syntax', () => {
    it('should parse and execute @add', () => {
      const result = executeTacitCode('5 3 @add eval');
      expect(result).toEqual([8]);
    });

    it('should parse and execute @dup', () => {
      const result = executeTacitCode('42 @dup eval');
      expect(result).toEqual([42, 42]);
    });

    it('should parse and execute @swap', () => {
      const result = executeTacitCode('1 2 @swap eval');
      expect(result).toEqual([2, 1]);
    });

    it('should work with English abbreviations', () => {
      const result = executeTacitCode('10 5 @sub eval');
      expect(result).toEqual([5]);
    });
  });

  describe('@symbol with colon definitions', () => {
    it('should work with simple colon definition', () => {
      const result = executeTacitCode(': square dup mul ; 4 @square eval');
      expect(result).toEqual([16]);
    });

    it('should work with complex colon definition', () => {
      const result = executeTacitCode(': triple dup dup add add ; 5 @triple eval');
      expect(result).toEqual([15]);
    });

    it('should work with multiple colon definitions', () => {
      const result = executeTacitCode(
        ': double dup add ; : quadruple @double eval @double eval ; 3 @quadruple eval',
      );
      expect(result).toEqual([12]);
    });
  });

  describe('@symbol without eval (tagged values on stack)', () => {
    it('should push Tag.BUILTIN for built-ins', () => {
      executeTacitCode('@add');
      const stack = vm.getStackData();
      expect(stack.length).toBe(1);

      const { tag, value: _value } = fromTaggedValue(stack[0]);
      expect(tag).toBe(Tag.BUILTIN);
    });

    it('should push Tag.CODE for colon definitions', () => {
      executeTacitCode(': test 42 ; @test');
      const stack = vm.getStackData();
      expect(stack.length).toBe(1);

      const { tag, value: _value2 } = fromTaggedValue(stack[0]);
      expect(tag).toBe(Tag.CODE);
    });
  });

  describe('@symbol metaprogramming scenarios', () => {
    it('should store and use symbol references', () => {
      const result = executeTacitCode(`
        : addition @add eval ;
        5 3 addition
      `);
      expect(result).toEqual([8]);
    });

    it('should work with conditional execution', () => {
      const result = executeTacitCode(`
        : test-op 1 eq if @add else @sub ; ;
        5 3 1 test-op eval
      `);
      expect(result).toEqual([8]);
    });

    it('should work with list of operations', () => {
      const result = executeTacitCode(`
        2 3 @add eval
        4 @mul eval
      `);
      expect(result).toEqual([20]);
    });
  });

  describe('@symbol error handling', () => {
    it('should throw error for non-existent symbol', () => {
      expect(() => {
        executeTacitCode('@nonexistent eval');
      }).toThrow();
    });

    it('should throw error for malformed @symbol syntax', () => {
      expect(() => {
        executeTacitCode('@ eval');
      }).toThrow();
    });
  });

  describe('@symbol mixed with regular operations', () => {
    it('should work alongside regular operations', () => {
      const result = executeTacitCode('5 dup 3 @add eval mul');
      expect(result).toEqual([40]);
    });

    it('should work in word definitions', () => {
      const result = executeTacitCode(': use-ref 3 @add eval ; 7 use-ref');
      expect(result).toEqual([10]);
    });

    it('should work with multiple @symbols in one expression', () => {
      const result = executeTacitCode('1 2 @add eval 3 4 @mul eval @add eval');
      expect(result).toEqual([15]);
    });
  });

  describe('@symbol edge cases', () => {
    it('should handle @symbols with underscores and hyphens', () => {
      const result = executeTacitCode(
        ': my_word 42 ; : my-word 24 ; @my_word eval @my-word eval add',
      );
      expect(result).toEqual([66]);
    });

    it('should handle @symbols with numbers', () => {
      const result = executeTacitCode(': word2 100 ; : test123 50 ; @word2 eval @test123 eval add');
      expect(result).toEqual([150]);
    });

    it('should work with nested @symbol calls', () => {
      const result = executeTacitCode(`
        : get-op @add ;
        5 3 get-op eval eval
      `);
      expect(result).toEqual([8]);
    });
  });
});
