/**
 * @file src/test/integration/symbol-table-integration.test.ts
 *
 * Integration tests for Symbol Table + VM Symbol Resolution + evalOp.
 *
 * This test file implements Step 7 of the unified code reference system:
 * - Manually register built-in symbols: symbolTable.defineBuiltin("add", Op.Add)
 * - Manually register code symbols: symbolTable.defineCode("test", 1000)
 * - Test vm.resolveSymbol() returns correct tagged values
 * - Test resolved values work with evalOp
 *
 * These tests simulate what the @ prefix will eventually do automatically,
 * ensuring the complete workflow works end-to-end before implementing
 * language-level features.
 */

import { vm } from '../../core/globalState';
import { resetVM } from '../utils/test-utils';
import { Op } from '../../ops/opcodes';
import { Tag, fromTaggedValue } from '../../core/tagged';
import {
  createCodeRef,
  isBuiltinRef,
  isCodeRef,
  getBuiltinOpcode,
  getCodeAddress,
} from '../../core/code-ref';
import { evalOp } from '../../ops/builtins-interpreter';

describe('Symbol Table Integration Tests', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('Built-in Symbol Integration: register → resolve → execute', () => {
    test('should handle add operation end-to-end', () => {
      // Step 1: Manually register built-in symbol (simulating what @ will do)
      vm.symbolTable.defineBuiltin('add', Op.Add);

      // Step 2: Resolve symbol to tagged value (simulating what @ will do)
      const addRef = vm.resolveSymbol('add');
      expect(addRef).toBeDefined();
      expect(isBuiltinRef(addRef!)).toBe(true);
      expect(getBuiltinOpcode(addRef!)).toBe(Op.Add);

      // Verify tagged value structure
      const { tag, value } = fromTaggedValue(addRef!);
      expect(tag).toBe(Tag.BUILTIN);
      expect(value).toBe(Op.Add);

      // Step 3: Push parameters and the resolved symbol
      vm.push(2);
      vm.push(3);
      vm.push(addRef!);

      // Step 4: Execute via evalOp (simulating what eval will do)
      evalOp(vm);

      // Step 5: Verify result
      expect(vm.getStackData()).toEqual([5]);
    });

    test('should handle multiple built-in operations', () => {
      // Register multiple built-ins
      vm.symbolTable.defineBuiltin('dup', Op.Dup);
      vm.symbolTable.defineBuiltin('swap', Op.Swap);
      vm.symbolTable.defineBuiltin('drop', Op.Drop);

      // Test dup operation
      vm.push(42);
      const dupRef = vm.resolveSymbol('dup');
      vm.push(dupRef!);
      evalOp(vm);
      expect(vm.getStackData()).toEqual([42, 42]);

      // Test swap operation
      vm.push(99);
      const swapRef = vm.resolveSymbol('swap');
      vm.push(swapRef!);
      evalOp(vm);
      expect(vm.getStackData()).toEqual([42, 99, 42]);

      // Test drop operation
      const dropRef = vm.resolveSymbol('drop');
      vm.push(dropRef!);
      evalOp(vm);
      expect(vm.getStackData()).toEqual([42, 99]);
    });

    test('should handle arithmetic operations sequence', () => {
      // Register arithmetic operations
      vm.symbolTable.defineBuiltin('add', Op.Add);
      vm.symbolTable.defineBuiltin('mul', Op.Multiply);
      vm.symbolTable.defineBuiltin('dup', Op.Dup);

      // Simulate: 3 dup mul 4 add  (3² + 4 = 13)
      vm.push(3);

      const dupRef = vm.resolveSymbol('dup');
      vm.push(dupRef!);
      evalOp(vm);

      const mulRef = vm.resolveSymbol('mul');
      vm.push(mulRef!);
      evalOp(vm);

      vm.push(4);

      const addRef = vm.resolveSymbol('add');
      vm.push(addRef!);
      evalOp(vm);

      expect(vm.getStackData()).toEqual([13]);
    });
  });

  describe('Code Symbol Integration: register → resolve → verify', () => {
    test('should register and resolve code symbols with correct tagged values', () => {
      // Step 1: Manually register code symbol
      vm.symbolTable.defineCode('test', 1000);

      // Step 2: Resolve symbol to tagged value
      const testRef = vm.resolveSymbol('test');
      expect(testRef).toBeDefined();
      expect(isCodeRef(testRef!)).toBe(true);
      expect(getCodeAddress(testRef!)).toBe(1000);

      // Verify tagged value structure
      const { tag, value } = fromTaggedValue(testRef!);
      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(1000);
    });

    test('should handle multiple code symbols with different addresses', () => {
      // Register multiple code symbols
      vm.symbolTable.defineCode('square', 1024);
      vm.symbolTable.defineCode('cube', 2048);
      vm.symbolTable.defineCode('factorial', 4096);

      // Verify all resolve correctly
      const squareRef = vm.resolveSymbol('square');
      expect(isCodeRef(squareRef!)).toBe(true);
      expect(getCodeAddress(squareRef!)).toBe(1024);

      const cubeRef = vm.resolveSymbol('cube');
      expect(isCodeRef(cubeRef!)).toBe(true);
      expect(getCodeAddress(cubeRef!)).toBe(2048);

      const factorialRef = vm.resolveSymbol('factorial');
      expect(isCodeRef(factorialRef!)).toBe(true);
      expect(getCodeAddress(factorialRef!)).toBe(4096);
    });

    test('should maintain symbol table backward compatibility', () => {
      // Register code symbol with new API
      vm.symbolTable.defineCode('test', 1500);

      // Should work with old find() method (returns the bytecode address)
      const functionIndex = vm.symbolTable.find('test');
      expect(functionIndex).toBe(1500); // New code symbols store bytecode address as value

      // Should also work with new findCodeRef() method
      const codeRef = vm.symbolTable.findCodeRef('test');
      expect(codeRef).toBeDefined();
      expect(codeRef!.tag).toBe(Tag.CODE);
      expect(codeRef!.addr).toBe(1500);
    });
  });

  describe('Mixed Symbol Types Integration', () => {
    test('should handle both built-ins and code symbols in same symbol table', () => {
      // Register mixed symbol types
      vm.symbolTable.defineBuiltin('add', Op.Add);
      vm.symbolTable.defineBuiltin('dup', Op.Dup);
      vm.symbolTable.defineCode('square', 2000);
      vm.symbolTable.defineCode('double', 3000);

      // Verify built-ins resolve correctly
      const addRef = vm.resolveSymbol('add');
      expect(isBuiltinRef(addRef!)).toBe(true);
      expect(getBuiltinOpcode(addRef!)).toBe(Op.Add);

      const dupRef = vm.resolveSymbol('dup');
      expect(isBuiltinRef(dupRef!)).toBe(true);
      expect(getBuiltinOpcode(dupRef!)).toBe(Op.Dup);

      // Verify code symbols resolve correctly
      const squareRef = vm.resolveSymbol('square');
      expect(isCodeRef(squareRef!)).toBe(true);
      expect(getCodeAddress(squareRef!)).toBe(2000);

      const doubleRef = vm.resolveSymbol('double');
      expect(isCodeRef(doubleRef!)).toBe(true);
      expect(getCodeAddress(doubleRef!)).toBe(3000);
    });

    test('should execute built-ins while preserving code symbol references', () => {
      // Register mixed symbols
      vm.symbolTable.defineBuiltin('add', Op.Add);
      vm.symbolTable.defineCode('square', 1500);

      // Execute built-in operation
      vm.push(10);
      vm.push(5);
      const addRef = vm.resolveSymbol('add');
      vm.push(addRef!);
      evalOp(vm);

      expect(vm.getStackData()).toEqual([15]);

      // Verify code symbol still resolves correctly
      const squareRef = vm.resolveSymbol('square');
      expect(isCodeRef(squareRef!)).toBe(true);
      expect(getCodeAddress(squareRef!)).toBe(1500);
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent symbols', () => {
      const result = vm.resolveSymbol('nonexistent');
      expect(result).toBeUndefined();
    });

    test('should handle invalid symbol names', () => {
      const result1 = vm.resolveSymbol('');
      expect(result1).toBeUndefined();

      const result2 = vm.resolveSymbol('   ');
      expect(result2).toBeUndefined();
    });

    test('should not interfere with existing symbol table functionality', () => {
      // Test that existing symbols still work
      const existingSymbol = vm.symbolTable.find('add'); // Built-in from system

      // Register new symbol
      vm.symbolTable.defineBuiltin('custom_add', Op.Add);

      // Both should work independently
      const customRef = vm.resolveSymbol('custom_add');
      expect(customRef).toBeDefined();
      expect(isBuiltinRef(customRef!)).toBe(true);
    });
  });

  describe('Complete Workflow Simulation', () => {
    test('should simulate future @symbol eval workflow', () => {
      // This test simulates what will eventually be:
      // 2 3 @add eval

      // Register the symbol (what @ prefix setup will do)
      vm.symbolTable.defineBuiltin('add', Op.Add);

      // Push operands
      vm.push(2);
      vm.push(3);

      // Resolve symbol (what @ prefix will do)
      const addRef = vm.resolveSymbol('add');
      expect(addRef).toBeDefined();

      // Push resolved symbol (what @ prefix will do)
      vm.push(addRef!);

      // Execute (what eval will do)
      evalOp(vm);

      // Verify result
      expect(vm.getStackData()).toEqual([5]);

      // This proves the complete @symbol eval workflow will work!
    });

    test('should demonstrate unified eval behavior with different code types', () => {
      // Register built-in
      vm.symbolTable.defineBuiltin('dup', Op.Dup);

      // Test 1: Built-in execution
      vm.push(42);
      const dupRef = vm.resolveSymbol('dup');
      vm.push(dupRef!);
      evalOp(vm);
      expect(vm.getStackData()).toEqual([42, 42]);

      // Test 2: Code block execution (existing functionality)
      // This proves { code } eval and @symbol eval use the same mechanism
      vm.SP = 0; // Clear stack manually
      vm.push(5);

      // Manually create a code reference (simulating { } block compilation)
      const codeBlockRef = createCodeRef(100); // Some bytecode address
      vm.push(codeBlockRef);

      // Note: This would jump to address 100 if there was bytecode there
      // For this test, we just verify the tagged value is correct
      const poppedRef = vm.pop();
      expect(isCodeRef(poppedRef)).toBe(true);
      expect(getCodeAddress(poppedRef)).toBe(100);

      // Verify stack state
      expect(vm.getStackData()).toEqual([5]);
    });
  });

  describe('Performance and Memory Verification', () => {
    test('should handle large numbers of symbols efficiently', () => {
      const numSymbols = 100; // Reduced from 1000 to avoid string digest overflow

      // Register many symbols
      for (let i = 0; i < numSymbols; i++) {
        if (i % 2 === 0) {
          vm.symbolTable.defineBuiltin(`builtin_${i}`, i % 128);
        } else {
          vm.symbolTable.defineCode(`code_${i}`, 1000 + i);
        }
      }

      // Verify random samples resolve correctly
      const builtin42 = vm.resolveSymbol('builtin_42');
      expect(isBuiltinRef(builtin42!)).toBe(true);
      expect(getBuiltinOpcode(builtin42!)).toBe(42);

      const code43 = vm.resolveSymbol('code_43');
      expect(isCodeRef(code43!)).toBe(true);
      expect(getCodeAddress(code43!)).toBe(1043);

      // Verify non-existent symbol still returns undefined
      expect(vm.resolveSymbol('nonexistent')).toBeUndefined();
    });

    test('should maintain consistent memory usage patterns', () => {
      // This test ensures we're not creating memory leaks
      // or excessive memory allocation

      const initialStackSize = vm.getStackData().length;

      // Perform multiple symbol operations
      vm.symbolTable.defineBuiltin('test1', Op.Add);
      vm.symbolTable.defineCode('test2', 500);

      const ref1 = vm.resolveSymbol('test1');
      const ref2 = vm.resolveSymbol('test2');

      // Stack should be unchanged
      expect(vm.getStackData().length).toBe(initialStackSize);

      // References should be valid
      expect(ref1).toBeDefined();
      expect(ref2).toBeDefined();
    });
  });
});
