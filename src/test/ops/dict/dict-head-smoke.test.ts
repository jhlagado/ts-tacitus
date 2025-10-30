import { describe, test, expect, beforeEach } from '@jest/globals';
import { resetVM } from '../../utils/vm-test-utils';
import { vm } from '../../../lang/runtime';
import { NIL } from '../../../core/tagged';
import { fromTaggedValue, Tag } from '../../../core';

describe.skip('Heap dict smoke check', () => {
  beforeEach(() => {
    resetVM();
  });

  test('newDictHead is populated after resetVM/registerBuiltins', () => {
    expect(vm.newDictHead).toBeDefined();
    expect(vm.newDictHead).not.toBe(NIL);
  });

  test('builtin add is resolvable via symbolTable', () => {
    const tv = vm.symbolTable.findTaggedValue('add');
    expect(tv).toBeDefined();
    const info = fromTaggedValue(tv!);
    expect(info.tag).toBe(Tag.BUILTIN);
  });
});
