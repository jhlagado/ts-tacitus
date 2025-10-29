import { beforeEach, describe, expect, test } from '@jest/globals';
import { resetVM } from '../../utils/vm-test-utils';
import { vm } from '../../../lang/runtime';
import { Tokenizer } from '../../../lang/tokenizer';
import { parse } from '../../../lang/parser';
import { execute } from '../../../lang/interpreter';
import { Tag, fromTaggedValue } from '../../../core/tagged';
import { Op } from '../../../ops/opcodes';

describe('SymbolTable dict-first lookup (flagged)', () => {
  beforeEach(() => {
    resetVM();
    // Ensure default off before each test
    vm.symbolTable.setDictFirstLookup(false);
  });

  test('builtin parity (legacy vs dict-first)', () => {
    const legacy = vm.symbolTable.findTaggedValue('add');
    expect(legacy).toBeDefined();
    expect(fromTaggedValue(legacy!).tag).toBe(Tag.BUILTIN);
    expect(fromTaggedValue(legacy!).value).toBe(Op.Add);

    vm.symbolTable.setDictFirstLookup(true);
    const dictFirst = vm.symbolTable.findTaggedValue('add');
    expect(dictFirst).toBeDefined();
    expect(dictFirst).toBe(legacy);
  });

  test('colon definition parity (legacy vs dict-first)', () => {
    parse(new Tokenizer(': inc 1 add ;'));
    execute(vm.compiler.BCP);

    const legacy = vm.symbolTable.findTaggedValue('inc');
    expect(legacy).toBeDefined();
    expect(fromTaggedValue(legacy!).tag).toBe(Tag.CODE);

    vm.symbolTable.setDictFirstLookup(true);
    const dictFirst = vm.symbolTable.findTaggedValue('inc');
    expect(dictFirst).toBeDefined();
    expect(dictFirst).toBe(legacy);
  });
});

