/**
 * @file src/test/strings/symbol-table-shadowing.test.ts
 * Tests for natural Forth-style shadowing in SymbolTable
 */

import { SymbolTable } from '../../strings/symbol-table';
import { Digest } from '../../strings/digest';
import { Memory } from '../../core/memory';
import { fromTaggedValue, isLocal, Tag } from '../../core/tagged';

describe('SymbolTable Natural Shadowing', () => {
  let digest: Digest;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    const memory = new Memory();
    digest = new Digest(memory);
    symbolTable = new SymbolTable(digest);
  });

  test('should shadow globals naturally', () => {
    // Define global 'x'
    symbolTable.defineBuiltin('x', 42);
    
    // Define local 'x' in function
    const checkpoint = symbolTable.mark();
    symbolTable.defineLocal('x'); // shadows global
    
    const resolved = symbolTable.findTaggedValue('x');
    expect(isLocal(resolved!)).toBe(true); // Local wins
    expect(fromTaggedValue(resolved!).value).toBe(0);
    
    symbolTable.revert(checkpoint);
    const globalResolved = symbolTable.findTaggedValue('x');
    expect(isLocal(globalResolved!)).toBe(false); // Global restored
    expect(fromTaggedValue(globalResolved!).tag).toBe(Tag.BUILTIN);
  });

  test('should handle multiple shadowing levels', () => {
    // Global definition
    symbolTable.defineBuiltin('var', 100);
    
    // First function level
    const checkpoint1 = symbolTable.mark();
    symbolTable.defineLocal('var'); // slot 0
    
    const firstLevel = symbolTable.findTaggedValue('var');
    expect(isLocal(firstLevel!)).toBe(true);
    expect(fromTaggedValue(firstLevel!).value).toBe(0);
    
    // Second function level (nested)
    const checkpoint2 = symbolTable.mark();
    symbolTable.defineLocal('var'); // slot 0 again
    
    const secondLevel = symbolTable.findTaggedValue('var');
    expect(isLocal(secondLevel!)).toBe(true);
    expect(fromTaggedValue(secondLevel!).value).toBe(0);
    
    // Revert to first level
    symbolTable.revert(checkpoint2);
    const backToFirst = symbolTable.findTaggedValue('var');
    expect(isLocal(backToFirst!)).toBe(true);
    expect(fromTaggedValue(backToFirst!).value).toBe(0);
    
    // Revert to global
    symbolTable.revert(checkpoint1);
    const backToGlobal = symbolTable.findTaggedValue('var');
    expect(isLocal(backToGlobal!)).toBe(false);
    expect(fromTaggedValue(backToGlobal!).tag).toBe(Tag.BUILTIN);
    expect(fromTaggedValue(backToGlobal!).value).toBe(100);
  });

  test('should shadow code definitions', () => {
    // Define a code definition
    symbolTable.defineCode('square', 1000);
    
    const checkpoint = symbolTable.mark();
    symbolTable.defineLocal('square'); // shadows code def
    
    const resolved = symbolTable.findTaggedValue('square');
    expect(isLocal(resolved!)).toBe(true);
    expect(fromTaggedValue(resolved!).value).toBe(0);
    
    symbolTable.revert(checkpoint);
    const codeResolved = symbolTable.findTaggedValue('square');
    expect(fromTaggedValue(codeResolved!).tag).toBe(Tag.CODE);
    expect(fromTaggedValue(codeResolved!).value).toBe(1000);
  });

  test('should handle mixed symbol types in function', () => {
    // Define various global symbols
    symbolTable.defineBuiltin('add', 1);
    symbolTable.defineBuiltin('dup', 2);
    symbolTable.defineCode('square', 500);
    symbolTable.defineCode('cube', 600);
    
    const checkpoint = symbolTable.mark();
    
    // Define locals that shadow some globals
    symbolTable.defineLocal('add');    // shadows builtin
    symbolTable.defineLocal('square'); // shadows code
    symbolTable.defineLocal('x');      // new local
    symbolTable.defineLocal('y');      // new local
    
    // Test shadowed symbols
    const addRef = symbolTable.findTaggedValue('add');
    expect(isLocal(addRef!)).toBe(true);
    expect(fromTaggedValue(addRef!).value).toBe(0);
    
    const squareRef = symbolTable.findTaggedValue('square');
    expect(isLocal(squareRef!)).toBe(true);
    expect(fromTaggedValue(squareRef!).value).toBe(1);
    
    // Test new locals
    const xRef = symbolTable.findTaggedValue('x');
    expect(isLocal(xRef!)).toBe(true);
    expect(fromTaggedValue(xRef!).value).toBe(2);
    
    const yRef = symbolTable.findTaggedValue('y');
    expect(isLocal(yRef!)).toBe(true);
    expect(fromTaggedValue(yRef!).value).toBe(3);
    
    // Test unshadowed globals
    const dupRef = symbolTable.findTaggedValue('dup');
    expect(fromTaggedValue(dupRef!).tag).toBe(Tag.BUILTIN);
    expect(fromTaggedValue(dupRef!).value).toBe(2);
    
    const cubeRef = symbolTable.findTaggedValue('cube');
    expect(fromTaggedValue(cubeRef!).tag).toBe(Tag.CODE);
    expect(fromTaggedValue(cubeRef!).value).toBe(600);
    
    // Revert and verify globals restored
    symbolTable.revert(checkpoint);
    
    const globalAdd = symbolTable.findTaggedValue('add');
    expect(fromTaggedValue(globalAdd!).tag).toBe(Tag.BUILTIN);
    expect(fromTaggedValue(globalAdd!).value).toBe(1);
    
    const globalSquare = symbolTable.findTaggedValue('square');
    expect(fromTaggedValue(globalSquare!).tag).toBe(Tag.CODE);
    expect(fromTaggedValue(globalSquare!).value).toBe(500);
    
    // Locals should be gone
    expect(symbolTable.findTaggedValue('x')).toBeUndefined();
    expect(symbolTable.findTaggedValue('y')).toBeUndefined();
  });

  test('should use dictionary order for resolution', () => {
    const checkpoint = symbolTable.mark();
    
    // Define multiple locals with same name (shouldn't happen in practice but tests ordering)
    symbolTable.defineLocal('test'); // slot 0, first definition
    
    // Access the private defineSymbol method to simulate multiple definitions
    // This tests that the linked list order determines resolution
    symbolTable.defineSymbol('test', fromTaggedValue(symbolTable.findTaggedValue('test')!).value + 100);
    
    const resolved = symbolTable.findTaggedValue('test');
    // Should get the most recent definition (higher value)
    expect(fromTaggedValue(resolved!).value).toBe(100);
    
    symbolTable.revert(checkpoint);
  });

  test('should handle empty symbol table gracefully', () => {
    // Test with no definitions
    expect(symbolTable.findTaggedValue('nonexistent')).toBeUndefined();
    
    const checkpoint = symbolTable.mark();
    expect(symbolTable.findTaggedValue('stillNonexistent')).toBeUndefined();
    
    symbolTable.revert(checkpoint);
    expect(symbolTable.findTaggedValue('alwaysNonexistent')).toBeUndefined();
  });

  test('should maintain shadowing with complex operations', () => {
    // Global base
    symbolTable.defineBuiltin('op', 50);
    
    // First level function
    const level1 = symbolTable.mark();
    symbolTable.defineLocal('op');     // slot 0
    symbolTable.defineLocal('temp');   // slot 1
    
    expect(fromTaggedValue(symbolTable.findTaggedValue('op')!).value).toBe(0);
    expect(fromTaggedValue(symbolTable.findTaggedValue('temp')!).value).toBe(1);
    expect(symbolTable.getLocalCount()).toBe(2);
    
    // Second level function
    const level2 = symbolTable.mark();
    symbolTable.defineLocal('result'); // slot 0
    symbolTable.defineLocal('op');     // slot 1, shadows both global and level1 local
    
    expect(fromTaggedValue(symbolTable.findTaggedValue('op')!).value).toBe(1);
    expect(fromTaggedValue(symbolTable.findTaggedValue('result')!).value).toBe(0);
    expect(fromTaggedValue(symbolTable.findTaggedValue('temp')!).value).toBe(1); // Still accessible from level1
    expect(symbolTable.getLocalCount()).toBe(2);
    
    // Back to level 1
    symbolTable.revert(level2);
    expect(fromTaggedValue(symbolTable.findTaggedValue('op')!).value).toBe(0); // Level1 local
    expect(fromTaggedValue(symbolTable.findTaggedValue('temp')!).value).toBe(1);
    expect(symbolTable.findTaggedValue('result')).toBeUndefined();
    expect(symbolTable.getLocalCount()).toBe(2);
    
    // Back to global
    symbolTable.revert(level1);
    expect(fromTaggedValue(symbolTable.findTaggedValue('op')!).tag).toBe(Tag.BUILTIN);
    expect(fromTaggedValue(symbolTable.findTaggedValue('op')!).value).toBe(50);
    expect(symbolTable.findTaggedValue('temp')).toBeUndefined();
    // Note: localSlotCount is not reset by revert(), only by mark()
    expect(symbolTable.getLocalCount()).toBe(2); // Still reflects last mark()
  });
});