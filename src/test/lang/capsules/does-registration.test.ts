import { Tag, fromTaggedValue, toTaggedValue } from '../../../core';
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

  test('does is registered as immediate and compiles constructor exit', () => {
    const entry = vm.symbolTable.findEntry('does');
    expect(entry).toBeDefined();
    expect(entry?.isImmediate).toBe(true);
    expect(entry?.implementation).toBeDefined();
    // Simulate being inside a definition by placing EndDefinition closer on stack
    vm.push(toTaggedValue(Op.EndDefinition, Tag.BUILTIN));
    // Invoke immediate
    entry?.implementation?.(vm);
    // After invocation, closer should be EndCapsule (BUILTIN Op.EndCapsule)
    const { tag: closerTag, value } = fromTaggedValue(vm.peek());
    expect(closerTag).toBe(Tag.BUILTIN);
    expect(value).toBe(Op.EndCapsule);
    const { tag: entryTag } = fromTaggedValue(entry!.taggedValue);
    expect(entryTag).toBe(Tag.BUILTIN);
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

