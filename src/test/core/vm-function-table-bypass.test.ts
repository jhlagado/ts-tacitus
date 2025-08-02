/**
 * @file src/test/core/vm-function-table-bypass.test.ts
 *
 * Tests for the VM's function table bypass mechanism.
 *
 * This test suite verifies that the getFunctionTableBypass method correctly
 * extracts bytecode addresses from function table entries for user-defined words,
 * enabling migration to the direct addressing system.
 */

import { VM } from '../../core/vm';
import { Compiler } from '../../lang/compiler';
import { Tag } from '../../core/tagged';
import { createCodeRef } from '../../core/code-ref';

describe('VM Function Table Bypass', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
    const compiler = new Compiler(vm);
    vm.initializeCompiler(compiler);
  });

  describe('getFunctionTableBypass', () => {
    test('should return undefined for built-in opcodes (< 128)', () => {
      // Built-in opcodes should not be handled by bypass
      expect(vm.getFunctionTableBypass(0)).toBeUndefined();
      expect(vm.getFunctionTableBypass(5)).toBeUndefined();
      expect(vm.getFunctionTableBypass(127)).toBeUndefined();
    });

    test('should return undefined for non-existent function indices', () => {
      // Function indices that don't exist should return undefined
      expect(vm.getFunctionTableBypass(128)).toBeUndefined();
      expect(vm.getFunctionTableBypass(1000)).toBeUndefined();
      expect(vm.getFunctionTableBypass(32767)).toBeUndefined();
    });

    test('should extract bytecode address from colon definition function', () => {
      // Manually create a colon definition like the parser does
      const wordName = 'testWord';
      const startAddress = 1000;

      // Create the function that captures startAddress (like in beginDefinition)
      const wordFunction = (testVm: VM) => {
        testVm.rpush(testVm.IP); // Save return address
        testVm.rpush(testVm.BP); // Save base pointer
        testVm.BP = testVm.RP; // Set new base pointer
        testVm.IP = startAddress; // Jump to bytecode address
      };

      // Register it with function index 128 (first user-defined word)
      const functionIndex = 128;
      vm.symbolTable.defineCall(wordName, functionIndex, wordFunction);

      // Test that bypass correctly extracts the bytecode address
      const extractedAddress = vm.getFunctionTableBypass(functionIndex);
      expect(extractedAddress).toBe(startAddress);
    });

    test('should handle multiple colon definitions with different addresses', () => {
      // Create multiple colon definitions with different bytecode addresses
      const definitions = [
        { name: 'word1', index: 128, address: 500 },
        { name: 'word2', index: 129, address: 1500 },
        { name: 'word3', index: 130, address: 2000 },
      ];

      // Register each definition
      definitions.forEach(({ name, index, address }) => {
        const wordFunction = (testVm: VM) => {
          testVm.rpush(testVm.IP);
          testVm.rpush(testVm.BP);
          testVm.BP = testVm.RP;
          testVm.IP = address;
        };
        vm.symbolTable.defineCall(name, index, wordFunction);
      });

      // Test that bypass correctly extracts each address
      definitions.forEach(({ index, address }) => {
        const extractedAddress = vm.getFunctionTableBypass(index);
        expect(extractedAddress).toBe(address);
      });
    });

    test('should return undefined for functions without IP assignment pattern', () => {
      // Create a function that doesn't follow the colon definition pattern
      const wordName = 'invalidWord';
      const functionIndex = 128;

      const invalidFunction = (testVm: VM) => {
        // This function doesn't have the expected vm.IP = <number> pattern
        testVm.push(42);
      };

      vm.symbolTable.defineCall(wordName, functionIndex, invalidFunction);

      // Should return undefined since it can't extract address
      const extractedAddress = vm.getFunctionTableBypass(functionIndex);
      expect(extractedAddress).toBeUndefined();
    });

    test('should handle edge case addresses (0, max values)', () => {
      // Test with edge case bytecode addresses
      const edgeCases = [
        { name: 'zeroAddr', index: 128, address: 0 },
        { name: 'maxAddr', index: 129, address: 65535 },
      ];

      edgeCases.forEach(({ name, index, address }) => {
        const wordFunction = (testVm: VM) => {
          testVm.rpush(testVm.IP);
          testVm.rpush(testVm.BP);
          testVm.BP = testVm.RP;
          testVm.IP = address;
        };
        vm.symbolTable.defineCall(name, index, wordFunction);
      });

      // Verify extraction works for edge cases
      edgeCases.forEach(({ index, address }) => {
        const extractedAddress = vm.getFunctionTableBypass(index);
        expect(extractedAddress).toBe(address);
      });
    });
  });

  describe('Integration with existing system', () => {
    test('should work alongside normal symbol table operations', () => {
      // Define both built-in and colon definition
      vm.symbolTable.defineBuiltin('add', 5);

      const wordFunction = (testVm: VM) => {
        testVm.rpush(testVm.IP);
        testVm.rpush(testVm.BP);
        testVm.BP = testVm.RP;
        testVm.IP = 2000;
      };
      vm.symbolTable.defineCall('square', 128, wordFunction);

      // Test that bypass only works for colon definitions
      expect(vm.getFunctionTableBypass(5)).toBeUndefined(); // Built-in
      expect(vm.getFunctionTableBypass(128)).toBe(2000); // Colon definition

      // Test that normal lookups still work
      expect(vm.symbolTable.find('add')).toBe(5);
      expect(vm.symbolTable.find('square')).toBe(128);
    });

    test('should support the plan step 8 use case', () => {
      // This test verifies the specific use case described in Step 8:
      // "Use existing function table as source of truth initially"
      // "Test that bypass returns correct addresses"

      const testWord = 'exampleWord';
      const testAddress = 1234;
      const testIndex = 200;

      // Simulate how parser creates colon definitions
      const wordFunction = (testVm: VM) => {
        testVm.rpush(testVm.IP);
        testVm.rpush(testVm.BP);
        testVm.BP = testVm.RP;
        testVm.IP = testAddress;
      };

      vm.symbolTable.defineCall(testWord, testIndex, wordFunction);

      // Verify that bypass mechanism works as intended for Step 8
      const bypassAddress = vm.getFunctionTableBypass(testIndex);
      expect(bypassAddress).toBe(testAddress);

      // Verify this enables the future direct addressing goal
      // (This address can now be stored directly as tagged value)
      vm.symbolTable.defineCode(testWord + '_direct', testAddress);
      const directTaggedValue = vm.symbolTable.findTaggedValue(testWord + '_direct');
      expect(directTaggedValue).toBe(createCodeRef(testAddress));
    });
  });
});
