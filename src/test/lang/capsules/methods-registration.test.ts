import { Tag, fromTaggedValue } from '../../../core';
import { Op } from '../../../ops/opcodes';
import { vm, initializeInterpreter } from '../../../core/global-state';
import { resetVM } from '../../utils/vm-test-utils';

beforeAll(() => {
  initializeInterpreter();
});

describe('capsule word registration', () => {
  beforeEach(() => {
    resetVM();
  });

  test('methods is registered as immediate', () => {
    const entry = vm.symbolTable.findEntry('methods');
    expect(entry).toBeDefined();
    expect(entry?.isImmediate).toBe(true);
    expect(entry?.implementation).toBeDefined();
    expect(() => entry?.implementation?.(vm)).toThrow('not implemented');
    const { tag } = fromTaggedValue(entry!.taggedValue);
    expect(tag).toBe(Tag.BUILTIN);
  });

  test('dispatch builtin maps to opcode', () => {
    const entry = vm.symbolTable.findEntry('dispatch');
    expect(entry).toBeDefined();
    expect(entry?.isImmediate).toBe(false);
    const { tag, value } = fromTaggedValue(entry!.taggedValue);
    expect(tag).toBe(Tag.BUILTIN);
    expect(value).toBe(Op.Dispatch);
  });
});
