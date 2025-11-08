/**
 * @file src/test/integration/symbol-table-integration.test.ts
 *
 * Integration tests for Dictionary + VM Symbol Resolution + evalOp.
 *
 * This test file implements Step 7 of the unified code reference system:
 * - Manually register built-in symbols: defineBuiltin(vm, "add", Op.Add)
 * - Manually register code symbols: defineCode(vm, "test", 1000)
 * - Test resolveSymbol(vm, ) returns correct tagged values
 * - Test resolved values work with evalOp
 *
 * These tests simulate what the @ prefix will eventually do automatically,
 * ensuring the complete workflow works end-to-end before implementing
 * language-level features.
 */

import { createVM, type VM } from '../../core/vm';
import { STACK_BASE, CELL_SIZE } from '../../core/constants';
import { Op } from '../../ops/opcodes';
import { Tag, fromTaggedValue, createCodeRef } from '../../core';
import { defineBuiltin, defineCode } from '../../core/dictionary';
import {
  isBuiltinRef,
  isFuncRef,
  getBuiltinOpcode,
  getCodeAddress,
} from '../utils/core-test-utils';
import { evalOp } from '../../ops/core';
import { resolveSymbol, push, getStackData, pop } from '../../core/vm';

describe('Symbol Table Integration Tests', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('Built-in Symbol Integration: register → resolve → execute', () => {
    test('should handle add operation end-to-end', () => {
      defineBuiltin(vm, 'add', Op.Add);

      const addRef = resolveSymbol(vm, 'add');
      expect(addRef).toBeDefined();
      expect(isBuiltinRef(addRef!)).toBe(true);
      expect(getBuiltinOpcode(addRef!)).toBe(Op.Add);

      const { tag, value } = fromTaggedValue(addRef!);
      expect(tag).toBe(Tag.BUILTIN);
      expect(value).toBe(Op.Add);

      push(vm, 2);
      push(vm, 3);
      push(vm, addRef!);

      evalOp(vm);

      expect(getStackData(vm)).toEqual([5]);
    });

    test('should handle multiple built-in operations', () => {
      defineBuiltin(vm, 'dup', Op.Dup);
      defineBuiltin(vm, 'swap', Op.Swap);
      defineBuiltin(vm, 'drop', Op.Drop);

      push(vm, 42);
      const dupRef = resolveSymbol(vm, 'dup');
      push(vm, dupRef!);
      evalOp(vm);
      expect(getStackData(vm)).toEqual([42, 42]);

      push(vm, 99);
      const swapRef = resolveSymbol(vm, 'swap');
      push(vm, swapRef!);
      evalOp(vm);
      expect(getStackData(vm)).toEqual([42, 99, 42]);

      const dropRef = resolveSymbol(vm, 'drop');
      push(vm, dropRef!);
      evalOp(vm);
      expect(getStackData(vm)).toEqual([42, 99]);
    });

    test('should handle arithmetic operations sequence', () => {
      defineBuiltin(vm, 'add', Op.Add);
      defineBuiltin(vm, 'mul', Op.Multiply);
      defineBuiltin(vm, 'dup', Op.Dup);

      push(vm, 3);

      const dupRef = resolveSymbol(vm, 'dup');
      push(vm, dupRef!);
      evalOp(vm);

      const mulRef = resolveSymbol(vm, 'mul');
      push(vm, mulRef!);
      evalOp(vm);

      push(vm, 4);

      const addRef = resolveSymbol(vm, 'add');
      push(vm, addRef!);
      evalOp(vm);

      expect(getStackData(vm)).toEqual([13]);
    });
  });

  describe('Code Symbol Integration: register → resolve → verify', () => {
    test('should register and resolve code symbols with correct tagged values', () => {
      defineCode(vm, 'test', 1000);

      const testRef = resolveSymbol(vm, 'test');
      expect(testRef).toBeDefined();
      expect(isFuncRef(testRef!)).toBe(true);
      expect(getCodeAddress(testRef!)).toBe(1000);

      const { tag, value } = fromTaggedValue(testRef!);
      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(1000);
    });

    test('should handle multiple code symbols with different addresses', () => {
      defineCode(vm, 'square', 1024);
      defineCode(vm, 'cube', 2048);
      defineCode(vm, 'factorial', 4096);

      const squareRef = resolveSymbol(vm, 'square');
      expect(isFuncRef(squareRef!)).toBe(true);
      expect(getCodeAddress(squareRef!)).toBe(1024);

      const cubeRef = resolveSymbol(vm, 'cube');
      expect(isFuncRef(cubeRef!)).toBe(true);
      expect(getCodeAddress(cubeRef!)).toBe(2048);

      const factorialRef = resolveSymbol(vm, 'factorial');
      expect(isFuncRef(factorialRef!)).toBe(true);
      expect(getCodeAddress(factorialRef!)).toBe(4096);
    });

    test('should maintain symbol table backward compatibility', () => {
      defineCode(vm, 'test', 1500);

      const codeRef = resolveSymbol(vm, 'test');
      expect(codeRef).toBeDefined();
      const { tag, value: addr } = fromTaggedValue(codeRef!);
      expect(tag).toBe(Tag.CODE);
      expect(addr).toBe(1500);
    });
  });

  describe('Mixed Symbol Types Integration', () => {
    test('should handle both built-ins and code symbols in same symbol table', () => {
      defineBuiltin(vm, 'add', Op.Add);
      defineBuiltin(vm, 'dup', Op.Dup);
      defineCode(vm, 'square', 2000);
      defineCode(vm, 'double', 3000);

      const addRef = resolveSymbol(vm, 'add');
      expect(isBuiltinRef(addRef!)).toBe(true);
      expect(getBuiltinOpcode(addRef!)).toBe(Op.Add);

      const dupRef = resolveSymbol(vm, 'dup');
      expect(isBuiltinRef(dupRef!)).toBe(true);
      expect(getBuiltinOpcode(dupRef!)).toBe(Op.Dup);

      const squareRef = resolveSymbol(vm, 'square');
      expect(isFuncRef(squareRef!)).toBe(true);
      expect(getCodeAddress(squareRef!)).toBe(2000);

      const doubleRef = resolveSymbol(vm, 'double');
      expect(isFuncRef(doubleRef!)).toBe(true);
      expect(getCodeAddress(doubleRef!)).toBe(3000);
    });

    test('should execute built-ins while preserving code symbol references', () => {
      defineBuiltin(vm, 'add', Op.Add);
      defineCode(vm, 'square', 1500);

      push(vm, 10);
      push(vm, 5);
      const addRef = resolveSymbol(vm, 'add');
      push(vm, addRef!);
      evalOp(vm);

      expect(getStackData(vm)).toEqual([15]);

      const squareRef = resolveSymbol(vm, 'square');
      expect(isFuncRef(squareRef!)).toBe(true);
      expect(getCodeAddress(squareRef!)).toBe(1500);
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent symbols', () => {
      const result = resolveSymbol(vm, 'nonexistent');
      expect(result).toBeUndefined();
    });

    test('should handle invalid symbol names', () => {
      const result1 = resolveSymbol(vm, '');
      expect(result1).toBeUndefined();

      const result2 = resolveSymbol(vm, '   ');
      expect(result2).toBeUndefined();
    });

    test('should not interfere with existing symbol table functionality', () => {
      defineBuiltin(vm, 'custom_add', Op.Add);

      const customRef = resolveSymbol(vm, 'custom_add');
      expect(customRef).toBeDefined();
      expect(isBuiltinRef(customRef!)).toBe(true);
    });
  });

  describe('Complete Workflow Simulation', () => {
    test('should simulate future @symbol eval workflow', () => {
      defineBuiltin(vm, 'add', Op.Add);

      push(vm, 2);
      push(vm, 3);

      const addRef = resolveSymbol(vm, 'add');
      expect(addRef).toBeDefined();

      push(vm, addRef!);

      evalOp(vm);

      expect(getStackData(vm)).toEqual([5]);
    });

    test('should demonstrate unified eval behavior with different code types', () => {
      defineBuiltin(vm, 'dup', Op.Dup);

      push(vm, 42);
      const dupRef = resolveSymbol(vm, 'dup');
      push(vm, dupRef!);
      evalOp(vm);
      expect(getStackData(vm)).toEqual([42, 42]);

      vm.sp = STACK_BASE / CELL_SIZE;
      push(vm, 5);

      const codeBlockRef = createCodeRef(100);
      push(vm, codeBlockRef);

      const poppedRef = pop(vm);
      expect(isFuncRef(poppedRef)).toBe(true);
      expect(getCodeAddress(poppedRef)).toBe(100);

      expect(getStackData(vm)).toEqual([5]);
    });
  });

  describe('Performance and Memory Verification', () => {
    test('should handle large numbers of symbols efficiently', () => {
      const numSymbols = 100;

      for (let i = 0; i < numSymbols; i++) {
        if (i % 2 === 0) {
          defineBuiltin(vm, `builtin_${i}`, i % 128);
        } else {
          defineCode(vm, `code_${i}`, 1000 + i);
        }
      }

      const builtin42 = resolveSymbol(vm, 'builtin_42');
      expect(isBuiltinRef(builtin42!)).toBe(true);
      expect(getBuiltinOpcode(builtin42!)).toBe(42);

      const code43 = resolveSymbol(vm, 'code_43');
      expect(isFuncRef(code43!)).toBe(true);
      expect(getCodeAddress(code43!)).toBe(1043);

      expect(resolveSymbol(vm, 'nonexistent')).toBeUndefined();
    });

    test('should maintain consistent memory usage patterns', () => {
      const initialStackSize = getStackData(vm).length;

      defineBuiltin(vm, 'test1', Op.Add);
      defineCode(vm, 'test2', 500);

      const ref1 = resolveSymbol(vm, 'test1');
      const ref2 = resolveSymbol(vm, 'test2');

      expect(getStackData(vm).length).toBe(initialStackSize);

      expect(ref1).toBeDefined();
      expect(ref2).toBeDefined();
    });
  });
});
