/**
 * @file src/test/strings/symbol-table-local.test.ts
 * Tests for local variable functionality in SymbolTable
 */

import { SymbolTable, Digest } from '@src/strings';
import { Memory, fromTaggedValue, isLocal } from '@src/core';

describe('SymbolTable Local Variables', () => {
  let digest: Digest;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    const memory = new Memory();
    digest = new Digest(memory);
    symbolTable = new SymbolTable(digest);
  });

  test('should auto-assign slot numbers', () => {
    symbolTable.mark();
    symbolTable.defineLocal('x'); // slot 0
    symbolTable.defineLocal('y'); // slot 1
    expect(symbolTable.getLocalCount()).toBe(2);
    
    const xRef = symbolTable.findTaggedValue('x');
    expect(xRef).toBeDefined();
    expect(isLocal(xRef!)).toBe(true);
    expect(fromTaggedValue(xRef!).value).toBe(0);

    const yRef = symbolTable.findTaggedValue('y');
    expect(yRef).toBeDefined();
    expect(isLocal(yRef!)).toBe(true);
    expect(fromTaggedValue(yRef!).value).toBe(1);
  });

  test('should reset slot count on mark', () => {
    symbolTable.mark();
    symbolTable.defineLocal('x');
    expect(symbolTable.getLocalCount()).toBe(1);
    
    symbolTable.mark();
    expect(symbolTable.getLocalCount()).toBe(0);
    
    symbolTable.defineLocal('y'); // should be slot 0 again
    const yRef = symbolTable.findTaggedValue('y');
    expect(fromTaggedValue(yRef!).value).toBe(0);
  });

  test('should assign sequential slot numbers', () => {
    symbolTable.mark();
    for (let i = 0; i < 10; i++) {
      symbolTable.defineLocal(`var${i}`);
      const varRef = symbolTable.findTaggedValue(`var${i}`);
      expect(fromTaggedValue(varRef!).value).toBe(i);
    }
    expect(symbolTable.getLocalCount()).toBe(10);
  });

  test('should work with symbol table scoping', () => {
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
  });

  test('should handle 16-bit slot numbers', () => {
    symbolTable.mark();
    // Test near 16-bit boundary
    symbolTable['localSlotCount'] = 65534; // Access private field for testing
    symbolTable.defineLocal('maxVar');
    
    const maxRef = symbolTable.findTaggedValue('maxVar');
    expect(fromTaggedValue(maxRef!).value).toBe(65534);
    expect(symbolTable.getLocalCount()).toBe(65535);
  });

  test('should maintain count through multiple operations', () => {
    symbolTable.mark();
    expect(symbolTable.getLocalCount()).toBe(0);
    
    symbolTable.defineLocal('a');
    expect(symbolTable.getLocalCount()).toBe(1);
    
    symbolTable.defineLocal('b');
    symbolTable.defineLocal('c');
    expect(symbolTable.getLocalCount()).toBe(3);
    
    // Verify all variables have correct slots
    expect(fromTaggedValue(symbolTable.findTaggedValue('a')!).value).toBe(0);
    expect(fromTaggedValue(symbolTable.findTaggedValue('b')!).value).toBe(1);
    expect(fromTaggedValue(symbolTable.findTaggedValue('c')!).value).toBe(2);
  });
});
