import { describe, beforeEach, test, expect } from '@jest/globals';
import { createVM, type VM } from '../../../core/vm';
import { Tag, Tagged, getTaggedInfo } from '../../../core';
import { defineOp, lookupOp } from '../../../core/dictionary';
import { refToByte, isRef } from '../../../core/refs';
import { CELL_SIZE } from '../../../core/constants';
import { push, pop } from '../../../core/vm';

describe('dict define/lookup builtin (happy path)', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('define builtin then lookup returns REF to stored BUILTIN', () => {
    const name = 'my_builtin';
    const opcode = 123;

    const nameAddr = vm.digest.intern(name);
    const nameTagged = Tagged(nameAddr, Tag.STRING);
    const builtinTagged = Tagged(opcode, Tag.CODE, 0);

    // ( value name — ) define
    push(vm, builtinTagged);
    push(vm, nameTagged);
    defineOp(vm);

    // ( name — ref|NIL ) lookup
    push(vm, nameTagged);
    lookupOp(vm);
    const ref = pop(vm);
    expect(isRef(ref)).toBe(true);

    // Dereference and verify stored payload
    const addr = refToByte(ref);
    const stored = vm.memory.readCell(addr / CELL_SIZE);
    const info = getTaggedInfo(stored);
    expect(info.tag).toBe(Tag.CODE);
    expect(info.value).toBe(opcode);
  });
});
