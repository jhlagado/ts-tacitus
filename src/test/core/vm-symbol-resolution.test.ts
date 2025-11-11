/**
 * @file src/test/core/vm-symbol-resolution.test.ts
 *
 * Tests for VM-level symbol resolution functionality.
 * Verifies the resolveSymbol(vm, ) method works correctly with
 * both built-in operations and colon definitions.
 */

import { createVM, type VM } from '../../core/vm';
import { STACK_BASE, CELL_SIZE } from '../../core/constants';
import { Op } from '../../ops/opcodes';
import { Tag, fromTaggedValue, toTaggedValue, createBuiltinRef, createCodeRef } from '../../core';
import { resolveSymbol, push, pop } from '../../core/vm';
import {
  define,
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
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('resolveSymbol method', () => {
    test('should return undefined for non-existent symbols', () => {
      const result = resolveSymbol(vm, 'nonexistent');

      expect(result).toBeUndefined();
    });

    test('should resolve built-in symbols to Tag.BUILTIN tagged values', () => {
      define(vm, 'add', toTaggedValue(Op.Add, Tag.BUILTIN, 0));

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

      define(vm, 'square', toTaggedValue(testAddr, Tag.CODE, 0));

      const result = resolveSymbol(vm, 'square');

      expect(result).toBeDefined();
      expect(isFuncRef(result!)).toBe(true);
      expect(getCodeAddress(result!)).toBe(testAddr);

      const { tag, value } = fromTaggedValue(result!);
      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(testAddr);
    });

    test('should resolve multiple different symbol types', () => {
      define(vm, 'add', toTaggedValue(Op.Add, Tag.BUILTIN, 0));
      define(vm, 'dup', toTaggedValue(Op.Dup, Tag.BUILTIN, 0));
      define(vm, 'square', toTaggedValue(1000, Tag.CODE, 0));
      define(vm, 'cube', toTaggedValue(2000, Tag.CODE, 0));

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
      define(vm, 'test', toTaggedValue(Op.Add, Tag.BUILTIN, 0));
      define(vm, 'test', toTaggedValue(5000, Tag.CODE, 0));

      const result = resolveSymbol(vm, 'test');

      expect(isFuncRef(result!)).toBe(true);
      expect(getCodeAddress(result!)).toBe(5000);
    });

    test('resolved values should be executable by VM', () => {
      define(vm, 'add', toTaggedValue(Op.Add, Tag.BUILTIN, 0));
      define(vm, 'dup', toTaggedValue(Op.Dup, Tag.BUILTIN, 0));

      push(vm, 5);
      push(vm, 3);

      const addRef = resolveSymbol(vm, 'add');
      expect(addRef).toBeDefined();

      push(vm, addRef!);
      evalOp(vm);

      expect(vm.sp - STACK_BASE).toBe(1);
      expect(pop(vm)).toBe(8);
    });

    test('should maintain consistency with code-ref utilities', () => {
      define(vm, 'multiply', toTaggedValue(Op.Multiply, Tag.BUILTIN, 0));
      define(vm, 'test', toTaggedValue(1500, Tag.CODE, 0));

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
      define(vm, 'add', toTaggedValue(Op.Add, Tag.BUILTIN, 0));
      const checkpoint = markWithLocalReset(vm);

      define(vm, 'square', toTaggedValue(1000, Tag.CODE, 0));

      expect(resolveSymbol(vm, 'add')).toBeDefined();
      expect(resolveSymbol(vm, 'square')).toBeDefined();

      forget(vm, checkpoint);

      expect(resolveSymbol(vm, 'add')).toBeDefined();
      expect(resolveSymbol(vm, 'square')).toBeUndefined();
    });

    test('should resolve symbols defined with unified define method', () => {
      define(vm, 'oldStyle', toTaggedValue(200, Tag.CODE, 0));

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
