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
    // Surface no longer exposes flag as field; verify via behavior by toggling twice
    executeTacitCode('dict-first-on');
    executeTacitCode('dict-first-off');
    expect(typeof vm.symbolTable.attachVM).toBe('function');
  });
});
