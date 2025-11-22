import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM } from '../../../core/vm';
import { Tag, getTaggedInfo, Tagged, isNIL } from '../../../core';
import {
  define,
  lookup,
  mark,
  forget,
  hideDictionaryHead,
  unhideDictionaryHead,
  getDictionaryHeadInfo,
} from '../../../core/dictionary';

describe('dictionary-only builtins', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('defineBuiltin then lookup returns BUILTIN with opcode', () => {
    const name = 'my-add-op';
    const opcode = 99;
    define(vm, name, Tagged(opcode, Tag.CODE, 0));
    const tv = lookup(vm, name);
    expect(tv).toBeDefined();
    const info = getTaggedInfo(tv!);
    expect(info.tag).toBe(Tag.CODE);
    expect(info.value).toBe(opcode);
    expect(info.meta).toBe(0);
  });

  test('defineBuiltin (immediate) then lookup returns BUILTIN with meta=1', () => {
    const name = 'imm-op';
    const opcode = 7;
    const scope = mark(vm);
    // @ts-ignore test-only
    vm.compile.head = 0; // 0 = NIL/empty dictionary
    // @ts-ignore test-only
    define(vm, name, Tagged(opcode, Tag.CODE, 1));
    const tv = lookup(vm, name);
    expect(tv).toBeDefined();
    const info = getTaggedInfo(tv!);
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
    vm.compile.head = 0; // 0 = NIL/empty dictionary
    // @ts-ignore test-only
    // Define two entries; head is B, then A
    define(vm, a.name, Tagged(a.opcode, Tag.CODE, 0));
    define(vm, b.name, Tagged(b.opcode, Tag.CODE, 0));

    // Lookup head (B)
    let tv = lookup(vm, b.name);
    expect(tv).toBeDefined();
    let info = getTaggedInfo(tv!);
    expect(info.tag).toBe(Tag.CODE);
    expect(info.value).toBe(b.opcode);

    // Lookup previous (A)
    tv = lookup(vm, a.name);
    expect(tv).toBeDefined();
    info = getTaggedInfo(tv!);
    expect(info.tag).toBe(Tag.CODE);
    expect(info.value).toBe(a.opcode);
    forget(vm, scope);
  });

  test('hidden head entry is skipped by lookup until unhidden', () => {
    const scope = mark(vm);
    // @ts-ignore test-only
    vm.compile.head = 0;
    define(vm, 'hidden', Tagged(5, Tag.CODE, 0));

    let tv = lookup(vm, 'hidden');
    expect(isNIL(tv)).toBe(false);

    hideDictionaryHead(vm);
    tv = lookup(vm, 'hidden');
    expect(isNIL(tv)).toBe(true);

    const headInfo = getDictionaryHeadInfo(vm);
    expect(headInfo).toBeDefined();
    expect(headInfo?.hidden).toBe(true);

    unhideDictionaryHead(vm);
    tv = lookup(vm, 'hidden');
    expect(isNIL(tv)).toBe(false);

    const unhiddenInfo = getDictionaryHeadInfo(vm);
    expect(unhiddenInfo?.hidden).toBe(false);
    forget(vm, scope);
  });
});
