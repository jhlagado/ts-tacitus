/**
 * @file src/test/core/vm-symbol-resolution.test.ts
 *
 * Tests for VM-level symbol resolution functionality.
 * Verifies the vm.resolveSymbol() method works correctly with
 * both built-in operations and colon definitions.
 */

import { vm } from '../../core/globalState';
import { resetVM } from "../utils/vm-test-utils";
import { Op } from '../../ops/opcodes';
import { Tag } from '../../core/tagged';
import { fromTaggedValue } from '../../core/tagged';
import {
  createBuiltinRef,
  createCodeRef,
  isBuiltinRef,
  isCodeRef,
  getBuiltinOpcode,
  getCodeAddress,
} from '../../core/code-ref';
import { evalOp } from '../../ops/core-ops';

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
      // Register a built-in symbol
      vm.symbolTable.defineBuiltin('add', Op.Add);

      const result = vm.resolveSymbol('add');

      expect(result).toBeDefined();
      expect(isBuiltinRef(result!)).toBe(true);
      expect(getBuiltinOpcode(result!)).toBe(Op.Add);

      // Verify it has the correct tag
      const { tag, value } = fromTaggedValue(result!);
      expect(tag).toBe(Tag.BUILTIN);
      expect(value).toBe(Op.Add);
    });

    test('should resolve code symbols to Tag.CODE tagged values', () => {
      const testAddr = 1000;

      // Register a code symbol
      vm.symbolTable.defineCode('square', testAddr);

      const result = vm.resolveSymbol('square');

      expect(result).toBeDefined();
      expect(isCodeRef(result!)).toBe(true);
      expect(getCodeAddress(result!)).toBe(testAddr);

      // Verify it has the correct tag
      const { tag, value } = fromTaggedValue(result!);
      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(testAddr);
    });

    test('should resolve multiple different symbol types', () => {
      // Register multiple symbols of different types
      vm.symbolTable.defineBuiltin('add', Op.Add);
      vm.symbolTable.defineBuiltin('dup', Op.Dup);
      vm.symbolTable.defineCode('square', 1000);
      vm.symbolTable.defineCode('cube', 2000);

      // Verify built-ins
      const addResult = vm.resolveSymbol('add');
      expect(isBuiltinRef(addResult!)).toBe(true);
      expect(getBuiltinOpcode(addResult!)).toBe(Op.Add);

      const dupResult = vm.resolveSymbol('dup');
      expect(isBuiltinRef(dupResult!)).toBe(true);
      expect(getBuiltinOpcode(dupResult!)).toBe(Op.Dup);

      // Verify code definitions
      const squareResult = vm.resolveSymbol('square');
      expect(isCodeRef(squareResult!)).toBe(true);
      expect(getCodeAddress(squareResult!)).toBe(1000);

      const cubeResult = vm.resolveSymbol('cube');
      expect(isCodeRef(cubeResult!)).toBe(true);
      expect(getCodeAddress(cubeResult!)).toBe(2000);
    });

    test('should handle symbol shadowing correctly', () => {
      // Define a symbol, then redefine it
      vm.symbolTable.defineBuiltin('test', Op.Add);
      vm.symbolTable.defineCode('test', 5000); // Shadow with code definition

      const result = vm.resolveSymbol('test');

      // Should resolve to the most recent definition (code definition)
      expect(isCodeRef(result!)).toBe(true);
      expect(getCodeAddress(result!)).toBe(5000);
    });

    test('resolved values should be executable by VM', () => {
      // Setup: define symbols and prepare test data
      vm.symbolTable.defineBuiltin('add', Op.Add);
      vm.symbolTable.defineBuiltin('dup', Op.Dup);

      // Test built-in execution
      vm.push(5);
      vm.push(3);

      const addRef = vm.resolveSymbol('add');
      expect(addRef).toBeDefined();

      // Push the resolved reference and execute it
      vm.push(addRef!);
      evalOp(vm);

      // Should have computed 5 + 3 = 8
      expect(vm.SP).toBe(4); // One value on stack
      expect(vm.pop()).toBe(8);
    });

    test('should maintain consistency with code-ref utilities', () => {
      vm.symbolTable.defineBuiltin('multiply', Op.Multiply);
      vm.symbolTable.defineCode('test', 1500);

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
      vm.symbolTable.defineBuiltin('add', Op.Add);
      const checkpoint = vm.symbolTable.mark();

      vm.symbolTable.defineCode('square', 1000);

      // Both should be resolvable
      expect(vm.resolveSymbol('add')).toBeDefined();
      expect(vm.resolveSymbol('square')).toBeDefined();

      // Revert to checkpoint
      vm.symbolTable.revert(checkpoint);

      // Only 'add' should be resolvable now
      expect(vm.resolveSymbol('add')).toBeDefined();
      expect(vm.resolveSymbol('square')).toBeUndefined();
    });

    test('should resolve symbols defined with unified define method', () => {
      // Use existing define method (now unified with tagged values)
      // Use value >= 128 to get a code reference, not builtin reference
      vm.symbolTable.define('oldStyle', 200);

      // Should be resolvable since all definitions now create tagged values
      const resolved = vm.resolveSymbol('oldStyle');
      expect(resolved).toBeDefined();
      
      expect(isCodeRef(resolved!)).toBe(true);
      expect(getCodeAddress(resolved!)).toBe(200);

      // And should still be findable with old method for backward compatibility
      expect(vm.symbolTable.find('oldStyle')).toBe(200);
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
      // These shouldn't be found since they weren't defined
      expect(vm.resolveSymbol('symbol-with-dash')).toBeUndefined();
      expect(vm.resolveSymbol('symbol_with_underscore')).toBeUndefined();
      expect(vm.resolveSymbol('symbol123')).toBeUndefined();
    });
  });
});
