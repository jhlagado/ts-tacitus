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

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../core';
import { executeTacitCode } from '../utils/vm-test-utils';

describe('@symbol Parser/Compiler Integration - Step 14', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('Basic @symbol syntax', () => {
    it('should parse and execute @add', () => {
      const result = executeTacitCode(vm, '5 3 @add eval');
      expect(result).toEqual([8]);
    });

    it('should parse and execute @dup', () => {
      const result = executeTacitCode(vm, '42 @dup eval');
      expect(result).toEqual([42, 42]);
    });

    it('should parse and execute @swap', () => {
      const result = executeTacitCode(vm, '1 2 @swap eval');
      expect(result).toEqual([2, 1]);
    });

    it('should work with English abbreviations', () => {
      const result = executeTacitCode(vm, '10 5 @sub eval');
      expect(result).toEqual([5]);
    });
  });

  describe('@symbol with colon definitions', () => {
    it('should work with simple colon definition', () => {
      const result = executeTacitCode(vm, ': square dup mul ; 4 @square eval');
      expect(result).toEqual([16]);
    });

    it('should work with complex colon definition', () => {
      const result = executeTacitCode(vm, ': triple dup dup add add ; 5 @triple eval');
      expect(result).toEqual([15]);
    });

    it('should work with multiple colon definitions', () => {
      const result = executeTacitCode(
        vm,
        ': double dup add ; : quadruple @double eval @double eval ; 3 @quadruple eval',
      );
      expect(result).toEqual([12]);
    });
  });

  describe('@symbol without eval (tagged values on stack)', () => {
    // Moved to parser-symbol-builtin.test.ts
    // it('should push Tag.CODE for built-ins', () => { ... });
    // Moved to parser-symbol-code.test.ts
    // it('should push Tag.CODE for colon definitions', () => { ... });
  });

  describe('@symbol metaprogramming scenarios', () => {
    it('should store and use symbol references', () => {
      const result = executeTacitCode(
        vm,
        `
        : addition @add eval ;
        5 3 addition
      `,
      );
      expect(result).toEqual([8]);
    });

    it('should work with conditional execution', () => {
      const result = executeTacitCode(
        vm,
        `
        : test-op 1 eq if @add else @sub ; ;
        5 3 1 test-op eval
      `,
      );
      expect(result).toEqual([8]);
    });

    it('should work with list of operations', () => {
      const result = executeTacitCode(
        vm,
        `
        2 3 @add eval
        4 @mul eval
      `,
      );
      expect(result).toEqual([20]);
    });
  });

  describe('@symbol error handling', () => {
    it('should throw error for non-existent symbol', () => {
      expect(() => {
        executeTacitCode(vm, '@nonexistent eval');
      }).toThrow();
    });

    it('should throw error for malformed @symbol syntax', () => {
      expect(() => {
        executeTacitCode(vm, '@ eval');
      }).toThrow();
    });
  });

  describe('@symbol mixed with regular operations', () => {
    it('should work alongside regular operations', () => {
      const result = executeTacitCode(vm, '5 dup 3 @add eval mul');
      expect(result).toEqual([40]);
    });

    it('should work in word definitions', () => {
      const result = executeTacitCode(vm, ': use-ref 3 @add eval ; 7 use-ref');
      expect(result).toEqual([10]);
    });

    it('should work with multiple @symbols in one expression', () => {
      const result = executeTacitCode(vm, '1 2 @add eval 3 4 @mul eval @add eval');
      expect(result).toEqual([15]);
    });
  });

  describe('@symbol edge cases', () => {
    it('should handle @symbols with underscores and hyphens', () => {
      const result = executeTacitCode(
        vm,
        ': my_word 42 ; : my-word 24 ; @my_word eval @my-word eval add',
      );
      expect(result).toEqual([66]);
    });

    it('should handle @symbols with numbers', () => {
      const result = executeTacitCode(
        vm,
        ': word2 100 ; : test123 50 ; @word2 eval @test123 eval add',
      );
      expect(result).toEqual([150]);
    });

    it('should work with nested @symbol calls', () => {
      const result = executeTacitCode(
        vm,
        `
        : get-op @add ;
        5 3 get-op eval eval
      `,
      );
      expect(result).toEqual([8]);
    });
  });
});
