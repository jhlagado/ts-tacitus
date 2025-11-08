import { Tag, fromTaggedValue, toTaggedValue } from '../../../core';
import { Op } from '../../../ops/opcodes';
import { vm, initializeInterpreter } from '../../utils/vm-test-utils';
import { resetVM } from '../../utils/vm-test-utils';
import { findEntry } from '../../../core/dictionary';

beforeAll(() => {
  initializeInterpreter();
});

describe('capsule word registration', () => {
  beforeEach(() => {
    resetVM();
  });

  test('capsule is registered as immediate', () => {
    const entry = findEntry(vm, 'capsule');
    expect(entry).toBeDefined();
    expect(entry?.isImmediate).toBe(true);
    const { tag: entryTag } = fromTaggedValue(entry!.taggedValue);
    expect(entryTag).toBe(Tag.BUILTIN);
  });

  // 'does' alias removed; only 'capsule' is supported

  test('dispatch builtin maps to opcode', () => {
    const entry = findEntry(vm, 'dispatch');
    expect(entry).toBeDefined();
    expect(entry?.isImmediate).toBe(false);
    const { tag, value } = fromTaggedValue(entry!.taggedValue);
    expect(tag).toBe(Tag.BUILTIN);
    expect(value).toBe(Op.Dispatch);
  });
});
