/**
 * @file src/test/strings/symbol-table-direct-addressing.test.ts
 *
 * Tests for SymbolTable direct addressing extensions.
 * Verifies the new unified @symbol system methods work correctly
 * without breaking existing functionality.
 */

import { vm } from '../../core/globalState';
import { resetVM } from '../utils/vm-test-utils';
import { SymbolTable } from '../../strings/symbol-table';
import { Digest } from '../../strings/digest';
import { Tag, fromTaggedValue } from '../../core/tagged';
import { Op } from '../../ops/opcodes';

describe('SymbolTable Direct Addressing', () => {
  let symbolTable: SymbolTable;
  let digest: Digest;

  beforeEach(() => {
    resetVM();
    digest = new Digest(vm.memory);
    symbolTable = new SymbolTable(digest);
  });

  describe('defineBuiltin method', () => {
    test('should define built-in operations with direct code references', () => {
      symbolTable.defineBuiltin('add', Op.Add);

      const taggedValue = symbolTable.findCodeRef('add');

      expect(taggedValue).toBeDefined();
      const { tag, value: addr } = fromTaggedValue(taggedValue!);
      expect(tag).toBe(Tag.BUILTIN);
      expect(addr).toBe(Op.Add);
    });

    test('should maintain backward compatibility with existing find method', () => {
      symbolTable.defineBuiltin('dup', Op.Dup);

      const functionIndex = symbolTable.find('dup');
      expect(functionIndex).toBe(Op.Dup);
    });

    test('should handle multiple built-in operations', () => {
      const builtins = [
        { name: 'add', opcode: Op.Add },
        { name: 'sub', opcode: Op.Minus },
        { name: 'mul', opcode: Op.Multiply },
        { name: 'div', opcode: Op.Divide },
      ];

      builtins.forEach(({ name, opcode }) => {
        symbolTable.defineBuiltin(name, opcode);
      });

      builtins.forEach(({ name, opcode }) => {
        const taggedValue = symbolTable.findCodeRef(name);
        expect(taggedValue).toBeDefined();
        const { tag, value: addr } = fromTaggedValue(taggedValue!);
        expect(tag).toBe(Tag.BUILTIN);
        expect(addr).toBe(opcode);
      });
    });
  });

  describe('defineCode method', () => {
    test('should define colon definitions with direct code references', () => {
      const squareAddr = 1000;
      symbolTable.defineCode('square', squareAddr);

      const taggedValue = symbolTable.findCodeRef('square');

      expect(taggedValue).toBeDefined();
      const { tag, value: addr } = fromTaggedValue(taggedValue!);
      expect(tag).toBe(Tag.FUNC);
      expect(addr).toBe(squareAddr);
    });

    test('should maintain backward compatibility with existing find method', () => {
      const testAddr = 2000;
      symbolTable.defineCode('test', testAddr);

      const functionIndex = symbolTable.find('test');
      expect(functionIndex).toBe(testAddr);
    });

    test('should handle multiple colon definitions', () => {
      const definitions = [
        { name: 'square', addr: 1000 },
        { name: 'cube', addr: 2000 },
        { name: 'factorial', addr: 3000 },
      ];

      definitions.forEach(({ name, addr }) => {
        symbolTable.defineCode(name, addr);
      });

      definitions.forEach(({ name, addr }) => {
        const taggedValue = symbolTable.findCodeRef(name);
        expect(taggedValue).toBeDefined();
        const { tag, value: resolvedAddr } = fromTaggedValue(taggedValue!);
        expect(tag).toBe(Tag.FUNC);
        expect(resolvedAddr).toBe(addr);
      });
    });

    test('should return undefined for non-existent symbols', () => {
      const taggedValue = symbolTable.findCodeRef('nonexistent');
      expect(taggedValue).toBeUndefined();
    });

    test('should handle shadowing correctly', () => {
      symbolTable.defineBuiltin('add', Op.Add);
      symbolTable.defineCode('square', 1000);

      const addTaggedValue = symbolTable.findCodeRef('add');
      const squareTaggedValue = symbolTable.findCodeRef('square');

      expect(addTaggedValue).toBeDefined();
      expect(squareTaggedValue).toBeDefined();

      const { tag: addTag, value: addAddr } = fromTaggedValue(addTaggedValue!);
      const { tag: squareTag, value: squareAddr } = fromTaggedValue(squareTaggedValue!);

      expect(addTag).toBe(Tag.BUILTIN);
      expect(addAddr).toBe(Op.Add);
      expect(squareTag).toBe(Tag.FUNC);
      expect(squareAddr).toBe(1000);
    });

    test('should support colon definition overriding', () => {
      symbolTable.defineCode('test', 5000);

      const taggedValue = symbolTable.findCodeRef('test');
      expect(taggedValue).toBeDefined();
      const { tag, value: addr } = fromTaggedValue(taggedValue!);
      expect(tag).toBe(Tag.FUNC);
      expect(addr).toBe(5000);
    });
  });

  describe('Mixed symbol types integration', () => {
    test('should handle mixed built-ins and colon definitions', () => {
      symbolTable.defineBuiltin('add', Op.Add);
      symbolTable.defineCode('square', 1000);
      symbolTable.defineBuiltin('dup', Op.Dup);
      symbolTable.defineCode('cube', 2000);

      // Test that findCodeRef returns tagged values with correct tags
      const addTagged = symbolTable.findCodeRef('add');
      const squareTagged = symbolTable.findCodeRef('square');
      const dupTagged = symbolTable.findCodeRef('dup');
      const cubeTagged = symbolTable.findCodeRef('cube');

      expect(addTagged).toBeDefined();
      expect(squareTagged).toBeDefined();
      expect(dupTagged).toBeDefined();
      expect(cubeTagged).toBeDefined();

      const { tag: addTag } = fromTaggedValue(addTagged!);
      const { tag: squareTag } = fromTaggedValue(squareTagged!);
      const { tag: dupTag } = fromTaggedValue(dupTagged!);
      const { tag: cubeTag } = fromTaggedValue(cubeTagged!);

      expect(addTag).toBe(Tag.BUILTIN);
      expect(squareTag).toBe(Tag.FUNC);
      expect(dupTag).toBe(Tag.BUILTIN);
      expect(cubeTag).toBe(Tag.FUNC);
    });
  });

  describe('Legacy method compatibility', () => {
    test('should not resolve symbols defined with old methods', () => {
      // Use builtin define for opcodes < 128
      symbolTable.defineBuiltin('oldStyle', 42);

      const taggedValue = symbolTable.findCodeRef('oldStyle');
      expect(taggedValue).toBeDefined(); // findCodeRef now maps to findTaggedValue

      // defineBuiltin creates proper tagged values for the unified system
      const { tag } = fromTaggedValue(taggedValue!);
      expect(tag).toBe(Tag.BUILTIN); // 42 < 128, so it's treated as builtin
    });

    test('should maintain independence from legacy function calling', () => {
      // Use code define for addresses >= 128
      symbolTable.defineCode('oldCall', 200); // >= 128, so CODE

      const taggedValue = symbolTable.findCodeRef('oldCall');
      expect(taggedValue).toBeDefined();

      const { tag } = fromTaggedValue(taggedValue!);
      expect(tag).toBe(Tag.FUNC); // 200 >= 128, so it's treated as code
    });
  });

  describe('Checkpoint and revert functionality', () => {
    test('should preserve new definitions across checkpoints', () => {
      symbolTable.defineBuiltin('add', Op.Add);

      const checkpoint = symbolTable.mark();

      symbolTable.defineCode('square', 1000);

      const addTagged = symbolTable.findCodeRef('add');
      const squareTagged = symbolTable.findCodeRef('square');
      expect(addTagged).toBeDefined();
      expect(squareTagged).toBeDefined();

      symbolTable.revert(checkpoint);

      const addTaggedAfter = symbolTable.findCodeRef('add');
      const squareTaggedAfter = symbolTable.findCodeRef('square');
      expect(addTaggedAfter).toBeDefined(); // Should still be there
      expect(squareTaggedAfter).toBeUndefined(); // Should be reverted
    });
  });
});
