import { describe, test, expect, beforeEach } from '@jest/globals';
import { resetVM } from '../utils/vm-test-utils';
import { vm } from '../../lang/runtime';
import { Tag, fromTaggedValue, NIL, isNIL } from '../../core';
import { defineBuiltin, lookup, mark, forget } from '../../core/dictionary';
import { Op } from '../../ops/opcodes';

describe('dictionary-only builtins', () => {
  beforeEach(() => {
    resetVM()
    // defineBuiltin(vm, 'eval', Op.Eval, false);
    // defineBuiltin(vm, 'eval', Op.Eval, false);
  });

  test('defineBuiltin then lookup returns BUILTIN with opcode', () => {
    const name = 'my-add-op';
    const opcode = 99;
    defineBuiltin(vm, name, opcode, false);
    const tv = lookup(vm, name);
    expect(isNIL(tv)).toBe(false);
    const info = fromTaggedValue(tv!);
    expect(info.tag).toBe(Tag.BUILTIN);
    expect(info.value).toBe(opcode);
    expect(info.meta).toBe(0);
  });

  test('defineBuiltin (immediate) then lookup returns BUILTIN with meta=1', () => {
    // defineBuiltin(vm, 'eval', Op.Eval, false);
    const name = 'imm-op';
    const opcode = 7;
    // @ts-ignore test-only
    vm.head = NIL;
    defineBuiltin(vm, name, opcode, true);
    const tv = lookup(vm, name);
    expect(isNIL(tv)).toBe(false);
    const info = fromTaggedValue(tv!);
    expect(info.tag).toBe(Tag.BUILTIN);
    expect(info.value).toBe(opcode);
    expect(info.meta).toBe(1);
  });

  test('lookup walks to previous entry (two entries)', () => {
    // defineBuiltin(vm, 'eval', Op.Eval, false);
    const a = { name: 'opA', opcode: 10 };
    const b = { name: 'opB', opcode: 20 };
    const c = { name: 'opC', opcode: 30 };
    // @ts-ignore test-only
    vm.head = NIL;
    // Define two entries; head is B, then A
    defineBuiltin(vm, a.name, a.opcode, false);
    defineBuiltin(vm, b.name, b.opcode, false);
    defineBuiltin(vm, c.name, c.opcode, false);

    // Lookup head (B)
    let tv = lookup(vm, b.name);
    expect(isNIL(tv)).toBe(false);
    let info = fromTaggedValue(tv!);
    expect(info.tag).toBe(Tag.BUILTIN);
    expect(info.value).toBe(b.opcode);

    // Lookup previous (A)
    tv = lookup(vm, a.name);
    expect(isNIL(tv)).toBe(false);
    info = fromTaggedValue(tv!);
    expect(info.tag).toBe(Tag.BUILTIN);
    expect(info.value).toBe(a.opcode);
  });

});
