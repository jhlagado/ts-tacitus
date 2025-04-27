import { Memory } from '../core/memory';
import { Verb } from '../core/types';
import { SymbolTable, SymbolTableCheckpoint } from './symbol-table';
import { Digest } from './digest';
import { defineBuiltins } from '../ops/define-builtins';

describe('SymbolTable', () => {
  let symbolTable: SymbolTable;
  let initialCheckpoint: SymbolTableCheckpoint;
  const dummyVerb: Verb = vm => vm.push(0); // Simple verb for testing

  beforeEach(() => {
    symbolTable = new SymbolTable(new Digest(new Memory()));
    defineBuiltins(symbolTable);
    initialCheckpoint = symbolTable.mark(); // Mark initial state after builtins
  });

  describe('Define new words', () => {
    it('should define a new word and find it', () => {
      const newWord: Verb = vm => vm.push(42);
      symbolTable.define('newWord', newWord);
      expect(symbolTable.find('newWord')).toBe(newWord);
    });

    it('should override an existing word', () => {
      const originalWord: Verb = vm => vm.push(1);
      const newWord: Verb = vm => vm.push(2);
      symbolTable.define('overrideWord', originalWord);
      expect(symbolTable.find('overrideWord')).toBe(originalWord);
      symbolTable.define('overrideWord', newWord);
      expect(symbolTable.find('overrideWord')).toBe(newWord);
    });
  });

  describe('Find words', () => {
    it('should return undefined for a non-existent word', () => {
      expect(symbolTable.find('nonExistentWord')).toBeUndefined();
    });

    it('should find the most recently defined word', () => {
      const firstWord: Verb = vm => vm.push(1);
      const secondWord: Verb = vm => vm.push(2);
      symbolTable.define('duplicateWord', firstWord);
      symbolTable.define('duplicateWord', secondWord);
      expect(symbolTable.find('duplicateWord')).toBe(secondWord);
    });
  });

  describe('Mark and Revert', () => {
    it('should revert to a previous state', () => {
      // Mark the state after builtins
      const checkpoint1 = symbolTable.mark();

      // Define a new word
      symbolTable.define('word1', dummyVerb);
      expect(symbolTable.find('word1')).toBe(dummyVerb);

      // Revert to the checkpoint
      symbolTable.revert(checkpoint1);

      // The new word should no longer be defined
      expect(symbolTable.find('word1')).toBeUndefined();

      // Built-in words should still exist
      expect(symbolTable.find('+')).toBeDefined();
    });

    it('should handle multiple checkpoints and reverts', () => {
      // Define word A
      symbolTable.define('wordA', dummyVerb);
      const checkpointA = symbolTable.mark();
      expect(symbolTable.find('wordA')).toBe(dummyVerb);

      // Define word B
      symbolTable.define('wordB', dummyVerb);
      const checkpointB = symbolTable.mark();
      expect(symbolTable.find('wordB')).toBe(dummyVerb);

      // Define word C
      symbolTable.define('wordC', dummyVerb);
      expect(symbolTable.find('wordC')).toBe(dummyVerb);

      // Revert to checkpoint B (forget C)
      symbolTable.revert(checkpointB);
      expect(symbolTable.find('wordC')).toBeUndefined();
      expect(symbolTable.find('wordB')).toBe(dummyVerb);
      expect(symbolTable.find('wordA')).toBe(dummyVerb);

      // Revert to checkpoint A (forget B)
      symbolTable.revert(checkpointA);
      expect(symbolTable.find('wordC')).toBeUndefined();
      expect(symbolTable.find('wordB')).toBeUndefined();
      expect(symbolTable.find('wordA')).toBe(dummyVerb);

      // Revert to initial state (forget A)
      symbolTable.revert(initialCheckpoint);
      expect(symbolTable.find('wordC')).toBeUndefined();
      expect(symbolTable.find('wordB')).toBeUndefined();
      expect(symbolTable.find('wordA')).toBeUndefined();
      expect(symbolTable.find('+')).toBeDefined(); // Builtins still exist
    });

    it('should allow defining words after reverting', () => {
      const checkpoint = symbolTable.mark();
      symbolTable.define('tempWord', dummyVerb);
      expect(symbolTable.find('tempWord')).toBe(dummyVerb);

      symbolTable.revert(checkpoint);
      expect(symbolTable.find('tempWord')).toBeUndefined();

      symbolTable.define('newWordAfterRevert', dummyVerb);
      expect(symbolTable.find('newWordAfterRevert')).toBe(dummyVerb);

      // Revert again should forget the new word
      symbolTable.revert(checkpoint);
      expect(symbolTable.find('newWordAfterRevert')).toBeUndefined();
    });
  });
});
