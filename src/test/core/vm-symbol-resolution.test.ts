/**
 * @file src/test/core/vm-symbol-resolution.test.ts
 *
 * Tests for VM-level symbol resolution functionality.
 * Verifies the vm.resolveSymbol() method works correctly with
 * both built-in operations and colon definitions.
 */

import { vm } from '../../lang/runtime';
import { STACK_BASE, CELL_SIZE } from '../../core/constants';
import { resetVM } from '../utils/vm-test-utils';
import { Op } from '../../ops/opcodes';
import { Tag, fromTaggedValue } from '../../core';
import { createBuiltinRef, createCodeRef } from '../../core';
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
      const result = vm.resolveSymbol('nonexistent');

      expect(result).toBeUndefined();
    });

    test('should resolve built-in symbols to Tag.BUILTIN tagged values', () => {
      defineBuiltin(vm, 'add', Op.Add);

      const result = vm.resolveSymbol('add');

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

      const result = vm.resolveSymbol('square');

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

      const addResult = vm.resolveSymbol('add');
      expect(isBuiltinRef(addResult!)).toBe(true);
      expect(getBuiltinOpcode(addResult!)).toBe(Op.Add);

      const dupResult = vm.resolveSymbol('dup');
      expect(isBuiltinRef(dupResult!)).toBe(true);
      expect(getBuiltinOpcode(dupResult!)).toBe(Op.Dup);

      const squareResult = vm.resolveSymbol('square');
      expect(isFuncRef(squareResult!)).toBe(true);
      expect(getCodeAddress(squareResult!)).toBe(1000);

      const cubeResult = vm.resolveSymbol('cube');
      expect(isFuncRef(cubeResult!)).toBe(true);
      expect(getCodeAddress(cubeResult!)).toBe(2000);
    });

    test('should handle symbol shadowing correctly', () => {
      defineBuiltin(vm, 'test', Op.Add);
      defineCode(vm, 'test', 5000);

      const result = vm.resolveSymbol('test');

      expect(isFuncRef(result!)).toBe(true);
      expect(getCodeAddress(result!)).toBe(5000);
    });

    test('resolved values should be executable by VM', () => {
      defineBuiltin(vm, 'add', Op.Add);
      defineBuiltin(vm, 'dup', Op.Dup);

      vm.push(5);
      vm.push(3);

      const addRef = vm.resolveSymbol('add');
      expect(addRef).toBeDefined();

      vm.push(addRef!);
      evalOp(vm);

      expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(1);
      expect(vm.pop()).toBe(8);
    });

    test('should maintain consistency with code-ref utilities', () => {
      defineBuiltin(vm, 'multiply', Op.Multiply);
      defineCode(vm, 'test', 1500);

      const multiplyResolved = vm.resolveSymbol('multiply');
      const multiplyDirect = createBuiltinRef(Op.Multiply);

      expect(multiplyResolved).toBe(multiplyDirect);

      const testResolved = vm.resolveSymbol('test');
      const testDirect = createCodeRef(1500);

      expect(testResolved).toBe(testDirect);
    });
  });

  describe('integration with symbol table', () => {
    test('should work with symbol table checkpoint and revert', () => {
      defineBuiltin(vm, 'add', Op.Add);
      const checkpoint = markWithLocalReset(vm);

      defineCode(vm, 'square', 1000);

      expect(vm.resolveSymbol('add')).toBeDefined();
      expect(vm.resolveSymbol('square')).toBeDefined();

      forget(vm, checkpoint);

      expect(vm.resolveSymbol('add')).toBeDefined();
      expect(vm.resolveSymbol('square')).toBeUndefined();
    });

    test('should resolve symbols defined with unified define method', () => {
      defineCode(vm, 'oldStyle', 200);

      const resolved = vm.resolveSymbol('oldStyle');
      expect(resolved).toBeDefined();

      expect(isFuncRef(resolved!)).toBe(true);
      expect(getCodeAddress(resolved!)).toBe(200);

      expect(findBytecodeAddress(vm, 'oldStyle')).toBe(200);
    });
  });

  describe('error handling', () => {
    test('should handle empty symbol names gracefully', () => {
      const result = vm.resolveSymbol('');
      expect(result).toBeUndefined();
    });

    test('should handle whitespace symbol names gracefully', () => {
      const result = vm.resolveSymbol('   ');
      expect(result).toBeUndefined();
    });

    test('should handle symbols with unusual characters', () => {
      expect(vm.resolveSymbol('symbol-with-dash')).toBeUndefined();
      expect(vm.resolveSymbol('symbol_with_underscore')).toBeUndefined();
      expect(vm.resolveSymbol('symbol123')).toBeUndefined();
    });
  });
});
