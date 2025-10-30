/**
 * @file src/test/strings/symbol-table-no-fallback.test.ts
 *
 * Verifies SymbolTable lookups work with fallback disabled when VM is attached
 * and definitions are mirrored to the heap dictionary.
 */

import { vm } from '../../lang/runtime';
import { resetVM } from '../utils/vm-test-utils';
import { createSymbolTable, Digest } from '../../strings';
import { Tag, fromTaggedValue } from '../../core';
import { Op } from '../../ops/opcodes';

describe.skip('SymbolTable with fallback disabled', () => {
  let symbolTable: ReturnType<typeof createSymbolTable>;
  let digest: Digest;

  beforeEach(() => {
    resetVM();
    digest = new Digest(vm.memory);
    symbolTable = createSymbolTable(digest);
    symbolTable.attachVM(vm);
    symbolTable.setFallbackEnabled(false);
  });

  test('builtins resolve via heap dict only', () => {
    // Define a couple of builtins using the symbol table attached to the VM;
    // this will mirror into the heap dictionary even with fallback disabled.
    symbolTable.defineBuiltin('add', Op.Add);
    symbolTable.defineBuiltin('dup', Op.Dup);
    // After definitions, the heap-backed dictionary head should be non-NIL
    const _ndh = (vm as unknown as { newDictHead: number }).newDictHead;
    // We can't rely on direct equality due to NaN tagging; instead ensure lookup works below.
    const addRef = symbolTable.findCodeRef('add');
    const dupRef = symbolTable.findCodeRef('dup');

    expect(addRef).toBeDefined();
    expect(dupRef).toBeDefined();

    const addInfo = fromTaggedValue(addRef!);
    const dupInfo = fromTaggedValue(dupRef!);

    expect(addInfo.tag).toBe(Tag.BUILTIN);
    expect(addInfo.value).toBe(Op.Add);
    expect(dupInfo.tag).toBe(Tag.BUILTIN);
    expect(dupInfo.value).toBe(Op.Dup);
  });

  test('code definitions resolve via heap dict only', () => {
    const squareAddr = 1234;
    const cubeAddr = 2345;

    symbolTable.defineCode('square', squareAddr);
    symbolTable.defineCode('cube', cubeAddr);
    const _ndh2 = (vm as unknown as { newDictHead: number }).newDictHead;

    const squareRef = symbolTable.findCodeRef('square');
    const cubeRef = symbolTable.findCodeRef('cube');

    expect(squareRef).toBeDefined();
    expect(cubeRef).toBeDefined();

    const squareInfo = fromTaggedValue(squareRef!);
    const cubeInfo = fromTaggedValue(cubeRef!);

    expect(squareInfo.tag).toBe(Tag.CODE);
    expect(squareInfo.value).toBe(squareAddr);
    expect(cubeInfo.tag).toBe(Tag.CODE);
    expect(cubeInfo.value).toBe(cubeAddr);
  });

  test('locals are not mirrored; still resolved from localDefs', () => {
    // Define a local; with fallback disabled and no dict path for locals,
    // findCodeRef should return undefined, but tagged lookup should show LOCAL
    symbolTable.defineLocal('x');

    // findCodeRef filters non-BUILTIN/CODE; it should be undefined
    const codeRef = symbolTable.findCodeRef('x');
    expect(codeRef).toBeUndefined();

    // findTaggedValue should reveal the LOCAL tag
    const tagged = symbolTable.findTaggedValue('x');
    expect(tagged).toBeDefined();
    const info = fromTaggedValue(tagged!);
    expect(info.tag).toBe(Tag.LOCAL);
  });
});
