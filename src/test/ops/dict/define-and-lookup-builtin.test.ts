import { describe, beforeEach, test, expect } from '@jest/globals';
import { resetVM } from '../../utils/vm-test-utils';
import { vm } from '../../../lang/runtime';
import { Tag, toTaggedValue, fromTaggedValue } from '../../../core';
import { defineOp, lookupOp } from '../../../core/dictionary';
import { getByteAddressFromRef, isRef } from '../../../core/refs';
import { SEG_DATA } from '../../../core/constants';

describe('dict define/lookup builtin (happy path)', () => {
  beforeEach(() => resetVM());

  test('define builtin then lookup returns DATA_REF to stored BUILTIN', () => {
    const name = 'my_builtin';
    const opcode = 123;

    const nameAddr = vm.digest.intern(name);
    const nameTagged = toTaggedValue(nameAddr, Tag.STRING);
    const builtinTagged = toTaggedValue(opcode, Tag.BUILTIN, 0);

    // ( value name — ) define
    vm.push(builtinTagged);
    vm.push(nameTagged);
    defineOp(vm);

    // ( name — ref|NIL ) lookup
    vm.push(nameTagged);
    lookupOp(vm);
    const ref = vm.pop();
    expect(isRef(ref)).toBe(true);

    // Dereference and verify stored payload
    const addr = getByteAddressFromRef(ref);
    const stored = vm.memory.readFloat32(SEG_DATA, addr);
    const info = fromTaggedValue(stored);
    expect(info.tag).toBe(Tag.BUILTIN);
    expect(info.value).toBe(opcode);
  });
});

