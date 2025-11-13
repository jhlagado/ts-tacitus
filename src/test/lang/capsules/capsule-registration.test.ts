import { Tag, getTaggedInfo } from '../../../core';
import { Op } from '../../../ops/opcodes';
import { createVM, type VM } from '../../../core/vm';
import { findEntry } from '../../../core/dictionary';

describe('capsule word registration', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('capsule is registered as immediate', () => {
    const entry = findEntry(vm, 'capsule');
    expect(entry).toBeDefined();
    expect(entry?.isImmediate).toBe(true);
    const { tag: entryTag } = getTaggedInfo(entry!.taggedValue);
    // Builtins are now stored as Tag.CODE with value < 128
    expect(entryTag).toBe(Tag.CODE);
  });

  // 'does' alias removed; only 'capsule' is supported

  test('dispatch builtin maps to opcode', () => {
    const entry = findEntry(vm, 'dispatch');
    expect(entry).toBeDefined();
    expect(entry?.isImmediate).toBe(false);
    const { tag, value } = getTaggedInfo(entry!.taggedValue);
    // Builtins are now stored as Tag.CODE with value < 128
    expect(tag).toBe(Tag.CODE);
    expect(value).toBe(Op.Dispatch);
  });
});
