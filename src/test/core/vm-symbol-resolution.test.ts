/**
 * @file src/test/core/vm-symbol-resolution.test.ts
 *
 * Tests for VM-level symbol resolution functionality.
 * Verifies the resolveSymbol(vm, ) method works correctly with
 * both built-in operations and colon definitions.
 */

import { vm } from '../utils/vm-test-utils';
import { STACK_BASE, CELL_SIZE } from '../../core/constants';
import { resetVM } from '../utils/vm-test-utils';
import { Op } from '../../ops/opcodes';
import { Tag, fromTaggedValue } from '../../core';
import { createBuiltinRef, createCodeRef } from '../../core';
import { resolveSymbol, push, pop } from '../../core/vm';
import {
  defineBuiltin,
  defineCode,
  markWithLocalReset,
  forget,
  findBytecodeAddress,
} from '../../core/dictionary';
import {
  isBuiltinRef,
  isFuncRef,
  getBuiltinOpcode,
  getCodeAddress,
} from '../utils/core-test-utils';
import { evalOp } from '../../ops/core';

describe('VM Symbol Resolution', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('resolveSymbol method', () => {
    test('should return undefined for non-existent symbols', () => {
      const result = resolveSymbol(vm, 'nonexistent');

      expect(result).toBeUndefined();
    });

    test('should resolve built-in symbols to Tag.BUILTIN tagged values', () => {
      defineBuiltin(vm, 'add', Op.Add);

      const result = resolveSymbol(vm, 'add');

      expect(result).toBeDefined();
      expect(isBuiltinRef(result!)).toBe(true);
      expect(getBuiltinOpcode(result!)).toBe(Op.Add);

      const { tag, value } = fromTaggedValue(result!);
      expect(tag).toBe(Tag.BUILTIN);
      expect(value).toBe(Op.Add);
    });

    test('should resolve code symbols to Tag.CODE tagged values', () => {
      const testAddr = 1000;

      defineCode(vm, 'square', testAddr);

      const result = resolveSymbol(vm, 'square');

      expect(result).toBeDefined();
      expect(isFuncRef(result!)).toBe(true);
      expect(getCodeAddress(result!)).toBe(testAddr);

      const { tag, value } = fromTaggedValue(result!);
      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(testAddr);
    });

    test('should resolve multiple different symbol types', () => {
      defineBuiltin(vm, 'add', Op.Add);
      defineBuiltin(vm, 'dup', Op.Dup);
      defineCode(vm, 'square', 1000);
      defineCode(vm, 'cube', 2000);

      const addResult = resolveSymbol(vm, 'add');
      expect(isBuiltinRef(addResult!)).toBe(true);
      expect(getBuiltinOpcode(addResult!)).toBe(Op.Add);

      const dupResult = resolveSymbol(vm, 'dup');
      expect(isBuiltinRef(dupResult!)).toBe(true);
      expect(getBuiltinOpcode(dupResult!)).toBe(Op.Dup);

      const squareResult = resolveSymbol(vm, 'square');
      expect(isFuncRef(squareResult!)).toBe(true);
      expect(getCodeAddress(squareResult!)).toBe(1000);

      const cubeResult = resolveSymbol(vm, 'cube');
      expect(isFuncRef(cubeResult!)).toBe(true);
      expect(getCodeAddress(cubeResult!)).toBe(2000);
    });

    test('should handle symbol shadowing correctly', () => {
      defineBuiltin(vm, 'test', Op.Add);
      defineCode(vm, 'test', 5000);

      const result = resolveSymbol(vm, 'test');

      expect(isFuncRef(result!)).toBe(true);
      expect(getCodeAddress(result!)).toBe(5000);
    });

    test('resolved values should be executable by VM', () => {
      defineBuiltin(vm, 'add', Op.Add);
      defineBuiltin(vm, 'dup', Op.Dup);

      push(vm, 5);
      push(vm, 3);

      const addRef = resolveSymbol(vm, 'add');
      expect(addRef).toBeDefined();

      push(vm, addRef!);
      evalOp(vm);

      expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(1);
      expect(pop(vm)).toBe(8);
    });

    test('should maintain consistency with code-ref utilities', () => {
      defineBuiltin(vm, 'multiply', Op.Multiply);
      defineCode(vm, 'test', 1500);

      const multiplyResolved = resolveSymbol(vm, 'multiply');
      const multiplyDirect = createBuiltinRef(Op.Multiply);

      expect(multiplyResolved).toBe(multiplyDirect);

      const testResolved = resolveSymbol(vm, 'test');
      const testDirect = createCodeRef(1500);

      expect(testResolved).toBe(testDirect);
    });
  });

  describe('integration with symbol table', () => {
    test('should work with symbol table checkpoint and revert', () => {
      defineBuiltin(vm, 'add', Op.Add);
      const checkpoint = markWithLocalReset(vm);

      defineCode(vm, 'square', 1000);

      expect(resolveSymbol(vm, 'add')).toBeDefined();
      expect(resolveSymbol(vm, 'square')).toBeDefined();

      forget(vm, checkpoint);

      expect(resolveSymbol(vm, 'add')).toBeDefined();
      expect(resolveSymbol(vm, 'square')).toBeUndefined();
    });

    test('should resolve symbols defined with unified define method', () => {
      defineCode(vm, 'oldStyle', 200);

      const resolved = resolveSymbol(vm, 'oldStyle');
      expect(resolved).toBeDefined();

      expect(isFuncRef(resolved!)).toBe(true);
      expect(getCodeAddress(resolved!)).toBe(200);

      expect(findBytecodeAddress(vm, 'oldStyle')).toBe(200);
    });
  });

  describe('error handling', () => {
    test('should handle empty symbol names gracefully', () => {
      const result = resolveSymbol(vm, '');
      expect(result).toBeUndefined();
    });

    test('should handle whitespace symbol names gracefully', () => {
      const result = resolveSymbol(vm, '   ');
      expect(result).toBeUndefined();
    });

    test('should handle symbols with unusual characters', () => {
      expect(resolveSymbol(vm, 'symbol-with-dash')).toBeUndefined();
      expect(resolveSymbol(vm, 'symbol_with_underscore')).toBeUndefined();
      expect(resolveSymbol(vm, 'symbol123')).toBeUndefined();
    });
  });
});
