import { Memory } from '../../../core/memory';
import { createSymbolTable, SymbolTableCheckpoint } from '../../../../src/strings/symbol-table';
import { Digest } from '../../../../src/strings/digest';
import { VM } from '../../../core/vm';
import { registerBuiltins } from '../../../ops/builtins-register';
import { fromTaggedValue } from '../../../core';

describe('SymbolTable', () => {
  let symbolTable: ReturnType<typeof createSymbolTable>;
  let initialCheckpoint: SymbolTableCheckpoint;
  const dummyFunctionIndex = 200;
  beforeEach(() => {
    symbolTable = createSymbolTable(new Digest(new Memory()));
    const vm = new VM();
    registerBuiltins(vm, symbolTable);
    initialCheckpoint = symbolTable.mark();
  });

  describe('Define new words', () => {
    test('should define a new word and find it', () => {
      const newFunctionIndex = 201;
      symbolTable.defineCode('newWord', newFunctionIndex);
      const tv = symbolTable.findTaggedValue('newWord');
      expect(tv).toBeDefined();
      expect(fromTaggedValue(tv!).value).toBe(newFunctionIndex);
    });

    test('should override an existing word', () => {
      const originalIndex = 202;
      const newIndex = 203;
      symbolTable.defineCode('overrideWord', originalIndex);
      expect(fromTaggedValue(symbolTable.findTaggedValue('overrideWord')!).value).toBe(
        originalIndex,
      );
      symbolTable.defineCode('overrideWord', newIndex);
      expect(fromTaggedValue(symbolTable.findTaggedValue('overrideWord')!).value).toBe(newIndex);
    });
  });

  describe('Find words', () => {
    test('should return undefined for a non-existent word', () => {
      expect(symbolTable.findTaggedValue('nonExistentWord')).toBeUndefined();
    });

    test('should find the most recently defined word', () => {
      const firstIndex = 204;
      const secondIndex = 205;
      symbolTable.defineCode('duplicateWord', firstIndex);
      symbolTable.defineCode('duplicateWord', secondIndex);
      expect(fromTaggedValue(symbolTable.findTaggedValue('duplicateWord')!).value).toBe(
        secondIndex,
      );
    });
  });

  describe('Mark and Revert', () => {
    test('should revert to a previous state', () => {
      const checkpoint1 = symbolTable.mark();
      symbolTable.defineCode('word1', dummyFunctionIndex);
      expect(fromTaggedValue(symbolTable.findTaggedValue('word1')!).value).toBe(
        dummyFunctionIndex,
      );
      symbolTable.revert(checkpoint1);
      expect(symbolTable.findTaggedValue('word1')).toBeUndefined();
      expect(symbolTable.findTaggedValue('add')).toBeDefined();
    });

    test('should handle multiple checkpoints and reverts', () => {
      symbolTable.defineCode('wordA', dummyFunctionIndex);
      const checkpointA = symbolTable.mark();
      expect(fromTaggedValue(symbolTable.findTaggedValue('wordA')!).value).toBe(
        dummyFunctionIndex,
      );
      symbolTable.defineCode('wordB', dummyFunctionIndex + 1);
      const checkpointB = symbolTable.mark();
      expect(fromTaggedValue(symbolTable.findTaggedValue('wordB')!).value).toBe(
        dummyFunctionIndex + 1,
      );
      symbolTable.defineCode('wordC', dummyFunctionIndex + 2);
      expect(fromTaggedValue(symbolTable.findTaggedValue('wordC')!).value).toBe(
        dummyFunctionIndex + 2,
      );
      symbolTable.revert(checkpointB);
      expect(symbolTable.findTaggedValue('wordC')).toBeUndefined();
      expect(fromTaggedValue(symbolTable.findTaggedValue('wordB')!).value).toBe(
        dummyFunctionIndex + 1,
      );
      expect(fromTaggedValue(symbolTable.findTaggedValue('wordA')!).value).toBe(
        dummyFunctionIndex,
      );
      symbolTable.revert(checkpointA);
      expect(symbolTable.findTaggedValue('wordC')).toBeUndefined();
      expect(symbolTable.findTaggedValue('wordB')).toBeUndefined();
      expect(fromTaggedValue(symbolTable.findTaggedValue('wordA')!).value).toBe(
        dummyFunctionIndex,
      );
      symbolTable.revert(initialCheckpoint);
      expect(symbolTable.find('wordC')).toBeUndefined();
      expect(symbolTable.find('wordB')).toBeUndefined();
      expect(symbolTable.find('wordA')).toBeUndefined();
      expect(symbolTable.find('add')).toBeDefined();
    });

    test('should allow defining words after reverting', () => {
      const checkpoint = symbolTable.mark();
      symbolTable.defineCode('tempWord', dummyFunctionIndex);
      expect(fromTaggedValue(symbolTable.findTaggedValue('tempWord')!).value).toBe(
        dummyFunctionIndex,
      );
      symbolTable.revert(checkpoint);
      expect(symbolTable.findTaggedValue('tempWord')).toBeUndefined();
      symbolTable.defineCode('newWordAfterRevert', dummyFunctionIndex);
      expect(fromTaggedValue(symbolTable.findTaggedValue('newWordAfterRevert')!).value).toBe(
        dummyFunctionIndex,
      );
      symbolTable.revert(checkpoint);
      expect(symbolTable.findTaggedValue('newWordAfterRevert')).toBeUndefined();
    });
  });

  // Global definitions removed in heap-backed dictionary migration
});
