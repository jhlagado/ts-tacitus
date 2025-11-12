import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM } from '../../../core/vm';
import { Tag, fromTaggedValue, toTaggedValue } from '../../../core';
import { define, lookup, mark, forget } from '../../../core/dictionary';

describe('dictionary-only builtins', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('defineBuiltin then lookup returns BUILTIN with opcode', () => {
    const name = 'my-add-op';
    const opcode = 99;
    define(vm, name, toTaggedValue(opcode, Tag.CODE, 0));
    const tv = lookup(vm, name);
    expect(tv).toBeDefined();
    const info = fromTaggedValue(tv!);
    expect(info.tag).toBe(Tag.CODE);
    expect(info.value).toBe(opcode);
    expect(info.meta).toBe(0);
  });

  test('defineBuiltin (immediate) then lookup returns BUILTIN with meta=1', () => {
    const name = 'imm-op';
    const opcode = 7;
    const scope = mark(vm);
    // @ts-ignore test-only
    vm.head = 0; // 0 = NIL/empty dictionary
    // @ts-ignore test-only
    define(vm, name, toTaggedValue(opcode, Tag.CODE, 1));
    const tv = lookup(vm, name);
    expect(tv).toBeDefined();
    const info = fromTaggedValue(tv!);
    expect(info.tag).toBe(Tag.CODE);
    expect(info.value).toBe(opcode);
    expect(info.meta).toBe(1);
    forget(vm, scope);
  });

  test('lookup walks to previous entry (two entries)', () => {
    const a = { name: 'opA', opcode: 10 };
    const b = { name: 'opB', opcode: 20 };
    const scope = mark(vm);
    // @ts-ignore test-only
    vm.head = 0; // 0 = NIL/empty dictionary
    // @ts-ignore test-only
    // Define two entries; head is B, then A
    define(vm, a.name, toTaggedValue(a.opcode, Tag.CODE, 0));
    define(vm, b.name, toTaggedValue(b.opcode, Tag.CODE, 0));

    // Lookup head (B)
    let tv = lookup(vm, b.name);
    expect(tv).toBeDefined();
    let info = fromTaggedValue(tv!);
    expect(info.tag).toBe(Tag.CODE);
    expect(info.value).toBe(b.opcode);

    // Lookup previous (A)
    tv = lookup(vm, a.name);
    expect(tv).toBeDefined();
    info = fromTaggedValue(tv!);
    expect(info.tag).toBe(Tag.CODE);
    expect(info.value).toBe(a.opcode);
    forget(vm, scope);
  });
});
