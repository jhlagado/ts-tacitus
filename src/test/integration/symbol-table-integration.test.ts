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
import { resetVM } from '../utils/vm-test-utils';
import { Op } from '../../ops/opcodes';
import { Tag, fromTaggedValue, createCodeRef } from '../../core';
import {
  isBuiltinRef,
  isFuncRef,
  getBuiltinOpcode,
  getCodeAddress,
} from '../utils/core-test-utils';
import { evalOp } from '../../ops/core';

describe('Symbol Table Integration Tests', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('Built-in Symbol Integration: register → resolve → execute', () => {
    test('should handle add operation end-to-end', () => {
      vm.symbolTable.defineBuiltin('add', Op.Add);

      const addRef = vm.resolveSymbol('add');
      expect(addRef).toBeDefined();
      expect(isBuiltinRef(addRef!)).toBe(true);
      expect(getBuiltinOpcode(addRef!)).toBe(Op.Add);

      const { tag, value } = fromTaggedValue(addRef!);
      expect(tag).toBe(Tag.BUILTIN);
      expect(value).toBe(Op.Add);

      vm.push(2);
      vm.push(3);
      vm.push(addRef!);

      evalOp(vm);

      expect(vm.getStackData()).toEqual([5]);
    });

    test('should handle multiple built-in operations', () => {
      vm.symbolTable.defineBuiltin('dup', Op.Dup);
      vm.symbolTable.defineBuiltin('swap', Op.Swap);
      vm.symbolTable.defineBuiltin('drop', Op.Drop);

      vm.push(42);
      const dupRef = vm.resolveSymbol('dup');
      vm.push(dupRef!);
      evalOp(vm);
      expect(vm.getStackData()).toEqual([42, 42]);

      vm.push(99);
      const swapRef = vm.resolveSymbol('swap');
      vm.push(swapRef!);
      evalOp(vm);
      expect(vm.getStackData()).toEqual([42, 99, 42]);

      const dropRef = vm.resolveSymbol('drop');
      vm.push(dropRef!);
      evalOp(vm);
      expect(vm.getStackData()).toEqual([42, 99]);
    });

    test('should handle arithmetic operations sequence', () => {
      vm.symbolTable.defineBuiltin('add', Op.Add);
      vm.symbolTable.defineBuiltin('mul', Op.Multiply);
      vm.symbolTable.defineBuiltin('dup', Op.Dup);

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
      vm.symbolTable.defineCode('test', 1000);

      const testRef = vm.resolveSymbol('test');
      expect(testRef).toBeDefined();
      expect(isFuncRef(testRef!)).toBe(true);
      expect(getCodeAddress(testRef!)).toBe(1000);

      const { tag, value } = fromTaggedValue(testRef!);
      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(1000);
    });

    test('should handle multiple code symbols with different addresses', () => {
      vm.symbolTable.defineCode('square', 1024);
      vm.symbolTable.defineCode('cube', 2048);
      vm.symbolTable.defineCode('factorial', 4096);

      const squareRef = vm.resolveSymbol('square');
      expect(isFuncRef(squareRef!)).toBe(true);
      expect(getCodeAddress(squareRef!)).toBe(1024);

      const cubeRef = vm.resolveSymbol('cube');
      expect(isFuncRef(cubeRef!)).toBe(true);
      expect(getCodeAddress(cubeRef!)).toBe(2048);

      const factorialRef = vm.resolveSymbol('factorial');
      expect(isFuncRef(factorialRef!)).toBe(true);
      expect(getCodeAddress(factorialRef!)).toBe(4096);
    });

    test('should maintain symbol table backward compatibility', () => {
      vm.symbolTable.defineCode('test', 1500);

      const functionIndex = vm.symbolTable.find('test');
      expect(functionIndex).toBe(1500);

      const codeRef = vm.symbolTable.findTaggedValue('test');
      expect(codeRef).toBeDefined();
      const { tag, value: addr } = fromTaggedValue(codeRef!);
      expect(tag).toBe(Tag.CODE);
      expect(addr).toBe(1500);
    });
  });

  describe('Mixed Symbol Types Integration', () => {
    test('should handle both built-ins and code symbols in same symbol table', () => {
      vm.symbolTable.defineBuiltin('add', Op.Add);
      vm.symbolTable.defineBuiltin('dup', Op.Dup);
      vm.symbolTable.defineCode('square', 2000);
      vm.symbolTable.defineCode('double', 3000);

      const addRef = vm.resolveSymbol('add');
      expect(isBuiltinRef(addRef!)).toBe(true);
      expect(getBuiltinOpcode(addRef!)).toBe(Op.Add);

      const dupRef = vm.resolveSymbol('dup');
      expect(isBuiltinRef(dupRef!)).toBe(true);
      expect(getBuiltinOpcode(dupRef!)).toBe(Op.Dup);

      const squareRef = vm.resolveSymbol('square');
      expect(isFuncRef(squareRef!)).toBe(true);
      expect(getCodeAddress(squareRef!)).toBe(2000);

      const doubleRef = vm.resolveSymbol('double');
      expect(isFuncRef(doubleRef!)).toBe(true);
      expect(getCodeAddress(doubleRef!)).toBe(3000);
    });

    test('should execute built-ins while preserving code symbol references', () => {
      vm.symbolTable.defineBuiltin('add', Op.Add);
      vm.symbolTable.defineCode('square', 1500);

      vm.push(10);
      vm.push(5);
      const addRef = vm.resolveSymbol('add');
      vm.push(addRef!);
      evalOp(vm);

      expect(vm.getStackData()).toEqual([15]);

      const squareRef = vm.resolveSymbol('square');
      expect(isFuncRef(squareRef!)).toBe(true);
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
      vm.symbolTable.defineBuiltin('custom_add', Op.Add);

      const customRef = vm.resolveSymbol('custom_add');
      expect(customRef).toBeDefined();
      expect(isBuiltinRef(customRef!)).toBe(true);
    });
  });

  describe('Complete Workflow Simulation', () => {
    test('should simulate future @symbol eval workflow', () => {

      vm.symbolTable.defineBuiltin('add', Op.Add);

      vm.push(2);
      vm.push(3);

      const addRef = vm.resolveSymbol('add');
      expect(addRef).toBeDefined();

      vm.push(addRef!);

      evalOp(vm);

      expect(vm.getStackData()).toEqual([5]);

    });

    test('should demonstrate unified eval behavior with different code types', () => {
      vm.symbolTable.defineBuiltin('dup', Op.Dup);

      vm.push(42);
      const dupRef = vm.resolveSymbol('dup');
      vm.push(dupRef!);
      evalOp(vm);
      expect(vm.getStackData()).toEqual([42, 42]);

      vm.SP = 0;
      vm.push(5);

      const codeBlockRef = createCodeRef(100);
      vm.push(codeBlockRef);

      const poppedRef = vm.pop();
      expect(isFuncRef(poppedRef)).toBe(true);
      expect(getCodeAddress(poppedRef)).toBe(100);

      expect(vm.getStackData()).toEqual([5]);
    });
  });

  describe('Performance and Memory Verification', () => {
    test('should handle large numbers of symbols efficiently', () => {
      const numSymbols = 100;

      for (let i = 0; i < numSymbols; i++) {
        if (i % 2 === 0) {
          vm.symbolTable.defineBuiltin(`builtin_${i}`, i % 128);
        } else {
          vm.symbolTable.defineCode(`code_${i}`, 1000 + i);
        }
      }

      const builtin42 = vm.resolveSymbol('builtin_42');
      expect(isBuiltinRef(builtin42!)).toBe(true);
      expect(getBuiltinOpcode(builtin42!)).toBe(42);

      const code43 = vm.resolveSymbol('code_43');
      expect(isFuncRef(code43!)).toBe(true);
      expect(getCodeAddress(code43!)).toBe(1043);

      expect(vm.resolveSymbol('nonexistent')).toBeUndefined();
    });

    test('should maintain consistent memory usage patterns', () => {

      const initialStackSize = vm.getStackData().length;

      vm.symbolTable.defineBuiltin('test1', Op.Add);
      vm.symbolTable.defineCode('test2', 500);

      const ref1 = vm.resolveSymbol('test1');
      const ref2 = vm.resolveSymbol('test2');

      expect(vm.getStackData().length).toBe(initialStackSize);

      expect(ref1).toBeDefined();
      expect(ref2).toBeDefined();
    });
  });
});
