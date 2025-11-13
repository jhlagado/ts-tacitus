import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM } from '../../../core/vm';
import { getTaggedInfo, Tag } from '../../../core';
import { resolveSymbol } from '../../../core/vm';

describe('find add after reset', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('add is resolvable', () => {
    const tv = resolveSymbol(vm, 'add');
    expect(tv).toBeDefined();
    const info = getTaggedInfo(tv!);
    // Builtins are now stored as Tag.CODE with value < 128
    expect(info.tag).toBe(Tag.CODE);
  });
});
