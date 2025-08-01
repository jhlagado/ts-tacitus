import { Memory } from '../../../core/memory';
import { SymbolTable, SymbolTableCheckpoint } from '../../../../src/strings/symbol-table';
import { Digest } from '../../../../src/strings/digest';
import { defineBuiltins } from '../../../ops/define-builtins';

describe('SymbolTable', () => {
  let symbolTable: SymbolTable;
  let initialCheckpoint: SymbolTableCheckpoint;
  const dummyFunctionIndex = 200;
  beforeEach(() => {
    symbolTable = new SymbolTable(new Digest(new Memory()));
    defineBuiltins(symbolTable);
    initialCheckpoint = symbolTable.mark();
  });

  describe('Define new words', () => {
    test('should define a new word and find it', () => {
      const newFunctionIndex = 201;
      symbolTable.define('newWord', newFunctionIndex);
      expect(symbolTable.find('newWord')).toBe(newFunctionIndex);
    });

    test('should override an existing word', () => {
      const originalIndex = 202;
      const newIndex = 203;
      symbolTable.define('overrideWord', originalIndex);
      expect(symbolTable.find('overrideWord')).toBe(originalIndex);
      symbolTable.define('overrideWord', newIndex);
      expect(symbolTable.find('overrideWord')).toBe(newIndex);
    });
  });

  describe('Find words', () => {
    test('should return undefined for a non-existent word', () => {
      expect(symbolTable.find('nonExistentWord')).toBeUndefined();
    });

    test('should find the most recently defined word', () => {
      const firstIndex = 204;
      const secondIndex = 205;
      symbolTable.define('duplicateWord', firstIndex);
      symbolTable.define('duplicateWord', secondIndex);
      expect(symbolTable.find('duplicateWord')).toBe(secondIndex);
    });
  });

  describe('Mark and Revert', () => {
    test('should revert to a previous state', () => {
      const checkpoint1 = symbolTable.mark();
      symbolTable.define('word1', dummyFunctionIndex);
      expect(symbolTable.find('word1')).toBe(dummyFunctionIndex);
      symbolTable.revert(checkpoint1);
      expect(symbolTable.find('word1')).toBeUndefined();
      expect(symbolTable.find('add')).toBeDefined();
    });

    test('should handle multiple checkpoints and reverts', () => {
      symbolTable.define('wordA', dummyFunctionIndex);
      const checkpointA = symbolTable.mark();
      expect(symbolTable.find('wordA')).toBe(dummyFunctionIndex);
      symbolTable.define('wordB', dummyFunctionIndex + 1);
      const checkpointB = symbolTable.mark();
      expect(symbolTable.find('wordB')).toBe(dummyFunctionIndex + 1);
      symbolTable.define('wordC', dummyFunctionIndex + 2);
      expect(symbolTable.find('wordC')).toBe(dummyFunctionIndex + 2);
      symbolTable.revert(checkpointB);
      expect(symbolTable.find('wordC')).toBeUndefined();
      expect(symbolTable.find('wordB')).toBe(dummyFunctionIndex + 1);
      expect(symbolTable.find('wordA')).toBe(dummyFunctionIndex);
      symbolTable.revert(checkpointA);
      expect(symbolTable.find('wordC')).toBeUndefined();
      expect(symbolTable.find('wordB')).toBeUndefined();
      expect(symbolTable.find('wordA')).toBe(dummyFunctionIndex);
      symbolTable.revert(initialCheckpoint);
      expect(symbolTable.find('wordC')).toBeUndefined();
      expect(symbolTable.find('wordB')).toBeUndefined();
      expect(symbolTable.find('wordA')).toBeUndefined();
      expect(symbolTable.find('add')).toBeDefined();
    });

    test('should allow defining words after reverting', () => {
      const checkpoint = symbolTable.mark();
      symbolTable.define('tempWord', dummyFunctionIndex);
      expect(symbolTable.find('tempWord')).toBe(dummyFunctionIndex);
      symbolTable.revert(checkpoint);
      expect(symbolTable.find('tempWord')).toBeUndefined();
      symbolTable.define('newWordAfterRevert', dummyFunctionIndex);
      expect(symbolTable.find('newWordAfterRevert')).toBe(dummyFunctionIndex);
      symbolTable.revert(checkpoint);
      expect(symbolTable.find('newWordAfterRevert')).toBeUndefined();
    });
  });
});
