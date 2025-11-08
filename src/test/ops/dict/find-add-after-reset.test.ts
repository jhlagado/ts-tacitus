import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM } from '../../../core/vm';
import { fromTaggedValue, Tag } from '../../../core';
import { resolveSymbol } from '../../../core/vm';

describe('find add after reset', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('add is resolvable', () => {
    const tv = resolveSymbol(vm, 'add');
    expect(tv).toBeDefined();
    const info = fromTaggedValue(tv!);
    expect(info.tag).toBe(Tag.BUILTIN);
  });
});
