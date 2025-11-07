import { describe, test, expect, beforeEach } from '@jest/globals';
import { resetVM } from '../../utils/vm-test-utils';
import { vm } from '../../../lang/runtime';
import { fromTaggedValue, Tag } from '../../../core';

describe('find add after reset', () => {
  beforeEach(() => resetVM());
  test('add is resolvable', () => {
    const tv = vm.resolveSymbol('add');
    expect(tv).toBeDefined();
    const info = fromTaggedValue(tv!);
    expect(info.tag).toBe(Tag.BUILTIN);
  });
});
