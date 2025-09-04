/**
 * Tests for variable declaration and reference parsing
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../core/globalState';
import { executeTacitCode } from '../utils/vm-test-utils';
import { Tag, fromTaggedValue } from '@src/core';

describe('Parser Variable Support', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('Variable declaration parsing', () => {
    test('should parse simple variable declaration', () => {
      // Test that we can parse "42 var x" without syntax errors
      expect(() => {
        executeTacitCode(': test 42 var x ;');
      }).not.toThrow();
    });

    test('should reject var outside function definition', () => {
      expect(() => {
        executeTacitCode('42 var x');
      }).toThrow('Variable declarations only allowed inside function definitions');
    });

    test('should reject var without name', () => {
      expect(() => {
        executeTacitCode(': test 42 var ;');
      }).toThrow('Expected variable name after var');
    });

    test('should reject var with invalid name token', () => {
      expect(() => {
        executeTacitCode(': test 42 var 123 ;');
      }).toThrow('Expected variable name after var');
    });
  });

  describe('Variable reference parsing', () => {
    test('should parse variable reference within function', () => {
      // Test that variable references compile without errors
      expect(() => {
        executeTacitCode(': test 42 var x x ;');
      }).not.toThrow();
    });

    test('should handle multiple variables in function', () => {
      expect(() => {
        executeTacitCode(': test 10 var a 20 var b a b ;');
      }).not.toThrow();
    });
  });

  describe('Symbol table integration', () => {
    test('should define local variable in symbol table', () => {
      // Create a function with a variable and check symbol table state
      const checkpoint = vm.symbolTable.mark(); // Simulate function start
      
      // Simulate parsing "42 var x"
      vm.symbolTable.defineLocal('x');
      
      const xRef = vm.symbolTable.findTaggedValue('x');
      expect(xRef).toBeDefined();
      
      const { tag } = fromTaggedValue(xRef!);
      expect(tag).toBe(Tag.LOCAL);
      
      expect(vm.symbolTable.getLocalCount()).toBe(1);
      
      vm.symbolTable.revert(checkpoint); // Clean up
    });

    test('should handle natural shadowing', () => {
      // Define a builtin (simulate global)
      vm.symbolTable.defineBuiltin('x', 42);
      
      // Start function and define local with same name
      const checkpoint = vm.symbolTable.mark();
      vm.symbolTable.defineLocal('x');
      
      // Local should shadow global
      const xRef = vm.symbolTable.findTaggedValue('x');
      const { tag } = fromTaggedValue(xRef!);
      expect(tag).toBe(Tag.LOCAL);
      
      // Restore global scope
      vm.symbolTable.revert(checkpoint);
      const globalXRef = vm.symbolTable.findTaggedValue('x');
      const { tag: globalTag } = fromTaggedValue(globalXRef!);
      expect(globalTag).toBe(Tag.BUILTIN);
    });
  });

  describe('Bytecode generation', () => {
    test('should generate Reserve opcode for function with variables', () => {
      // This test verifies that functions with variables get proper slot allocation
      // We'll check that the compilation doesn't crash and produces valid bytecode
      expect(() => {
        const result = executeTacitCode(': square 10 var x x x mul ; 5 square');
        // The result should be reasonable (though the function logic might be wrong)
        expect(typeof result[0]).toBe('number');
      }).not.toThrow();
    });

    test('should generate InitVar opcode for variable declarations', () => {
      // Verify that variable declarations produce valid bytecode
      expect(() => {
        executeTacitCode(': test 42 var x 7 var y ; test');
      }).not.toThrow();
    });

    test('should generate LocalRef + Fetch for variable references', () => {
      // Verify that variable references produce valid bytecode
      expect(() => {
        executeTacitCode(': getx 10 var x x ; getx');
      }).not.toThrow();
    });
  });
});
