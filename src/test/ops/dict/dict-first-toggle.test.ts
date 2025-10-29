import { beforeEach, describe, expect, test } from '@jest/globals';
import { resetVM } from '../../utils/vm-test-utils';
import { executeTacitCode } from '../../utils/vm-test-utils';
import { vm } from '../../../lang/runtime';

describe('dict-first toggle builtins', () => {
  beforeEach(() => {
    resetVM();
    vm.symbolTable.setDictFirstLookup(false);
  });

  test('dict-first-on and off toggle the flag', () => {
    expect(vm.symbolTable.dictLookupPreferred).toBe(false);
    executeTacitCode('dict-first-on');
    expect(vm.symbolTable.dictLookupPreferred).toBe(true);
    executeTacitCode('dict-first-off');
    expect(vm.symbolTable.dictLookupPreferred).toBe(false);
  });
});

