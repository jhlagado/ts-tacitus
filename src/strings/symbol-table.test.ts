import { Memory } from '../core/memory';
import { SymbolTable, SymbolTableCheckpoint } from './symbol-table';
import { Digest } from './digest';
import { defineBuiltins } from '../ops/define-builtins';

describe('SymbolTable', () => {
  let symbolTable: SymbolTable;
  let initialCheckpoint: SymbolTableCheckpoint;
  const dummyFunctionIndex = 200; // A dummy function index for testing

  beforeEach(() => {
    symbolTable = new SymbolTable(new Digest(new Memory()));
    defineBuiltins(symbolTable);
    initialCheckpoint = symbolTable.mark(); // Mark initial state after builtins
  });

  describe('Define new words', () => {
    it('should define a new word and find it', () => {
      const newFunctionIndex = 201;
      symbolTable.define('newWord', newFunctionIndex);
      expect(symbolTable.find('newWord')).toBe(newFunctionIndex);
    });

    it('should override an existing word', () => {
      const originalIndex = 202;
      const newIndex = 203;
      symbolTable.define('overrideWord', originalIndex);
      expect(symbolTable.find('overrideWord')).toBe(originalIndex);
      symbolTable.define('overrideWord', newIndex);
      expect(symbolTable.find('overrideWord')).toBe(newIndex);
    });
  });

  describe('Find words', () => {
    it('should return undefined for a non-existent word', () => {
      expect(symbolTable.find('nonExistentWord')).toBeUndefined();
    });

    it('should find the most recently defined word', () => {
      const firstIndex = 204;
      const secondIndex = 205;
      symbolTable.define('duplicateWord', firstIndex);
      symbolTable.define('duplicateWord', secondIndex);
      expect(symbolTable.find('duplicateWord')).toBe(secondIndex);
    });
  });

  describe('Mark and Revert', () => {
    it('should revert to a previous state', () => {
      // Mark the state after builtins
      const checkpoint1 = symbolTable.mark();

      // Define a new word
      symbolTable.define('word1', dummyFunctionIndex);
      expect(symbolTable.find('word1')).toBe(dummyFunctionIndex);

      // Revert to the checkpoint
      symbolTable.revert(checkpoint1);

      // The new word should no longer be defined
      expect(symbolTable.find('word1')).toBeUndefined();

      // Built-in words should still exist
      expect(symbolTable.find('add')).toBeDefined();
    });

    it('should handle multiple checkpoints and reverts', () => {
      // Define word A
      symbolTable.define('wordA', dummyFunctionIndex);
      const checkpointA = symbolTable.mark();
      expect(symbolTable.find('wordA')).toBe(dummyFunctionIndex);

      // Define word B
      symbolTable.define('wordB', dummyFunctionIndex + 1);
      const checkpointB = symbolTable.mark();
      expect(symbolTable.find('wordB')).toBe(dummyFunctionIndex + 1);

      // Define word C
      symbolTable.define('wordC', dummyFunctionIndex + 2);
      expect(symbolTable.find('wordC')).toBe(dummyFunctionIndex + 2);

      // Revert to checkpoint B (forget C)
      symbolTable.revert(checkpointB);
      expect(symbolTable.find('wordC')).toBeUndefined();
      expect(symbolTable.find('wordB')).toBe(dummyFunctionIndex + 1);
      expect(symbolTable.find('wordA')).toBe(dummyFunctionIndex);

      // Revert to checkpoint A (forget B)
      symbolTable.revert(checkpointA);
      expect(symbolTable.find('wordC')).toBeUndefined();
      expect(symbolTable.find('wordB')).toBeUndefined();
      expect(symbolTable.find('wordA')).toBe(dummyFunctionIndex);

      // Revert to initial state (forget A)
      symbolTable.revert(initialCheckpoint);
      expect(symbolTable.find('wordC')).toBeUndefined();
      expect(symbolTable.find('wordB')).toBeUndefined();
      expect(symbolTable.find('wordA')).toBeUndefined();
      expect(symbolTable.find('add')).toBeDefined(); // Builtins still exist
    });

    it('should allow defining words after reverting', () => {
      const checkpoint = symbolTable.mark();
      symbolTable.define('tempWord', dummyFunctionIndex);
      expect(symbolTable.find('tempWord')).toBe(dummyFunctionIndex);

      symbolTable.revert(checkpoint);
      expect(symbolTable.find('tempWord')).toBeUndefined();

      symbolTable.define('newWordAfterRevert', dummyFunctionIndex);
      expect(symbolTable.find('newWordAfterRevert')).toBe(dummyFunctionIndex);

      // Revert again should forget the new word
      symbolTable.revert(checkpoint);
      expect(symbolTable.find('newWordAfterRevert')).toBeUndefined();
    });
  });
});
