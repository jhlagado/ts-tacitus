import { describe, test, expect, beforeEach } from '@jest/globals';
import { resetVM } from '../utils/vm-test-utils';
import { vm } from '../../lang/runtime';
import { Tag, fromTaggedValue, isList, getListLength } from '../../core';
import * as symbols from '../../strings/symbols';
import { CELL_SIZE, SEG_DATA, GLOBAL_BASE_CELLS } from '../../core/constants';

describe('dictionary-only builtins', () => {
  beforeEach(() => resetVM());

  test('defineBuiltin writes LIST:3 entry at heap top with BUILTIN payload', () => {
    const name = 'my-add-op';
    symbols.defineBuiltin(vm, name, 99, false);
    const headerAddr = (GLOBAL_BASE_CELLS + vm.gp - 1) * CELL_SIZE;
    const header = vm.memory.readFloat32(SEG_DATA, headerAddr);
    expect(isList(header)).toBe(true);
    expect(getListLength(header)).toBe(3);
    const base = headerAddr - 3 * CELL_SIZE;
    const payload = vm.memory.readFloat32(SEG_DATA, base + 1 * CELL_SIZE);
    const entryName = vm.memory.readFloat32(SEG_DATA, base + 2 * CELL_SIZE);
    const p = fromTaggedValue(payload);
    const n = fromTaggedValue(entryName);
    expect(p.tag).toBe(Tag.BUILTIN);
    expect(p.value).toBe(99);
    expect(p.meta).toBe(0);
    expect(n.tag).toBe(Tag.STRING);
    expect(vm.digest.get(n.value)).toBe(name);
  });

  test('immediate builtin writes LIST:3 entry with meta=1', () => {
    const name = 'imm-op';
    symbols.defineBuiltin(vm, name, 7, true);
    const headerAddr = (GLOBAL_BASE_CELLS + vm.gp - 1) * CELL_SIZE;
    const header = vm.memory.readFloat32(SEG_DATA, headerAddr);
    expect(isList(header)).toBe(true);
    expect(getListLength(header)).toBe(3);
    const base = headerAddr - 3 * CELL_SIZE;
    const payload = vm.memory.readFloat32(SEG_DATA, base + 1 * CELL_SIZE);
    const entryName = vm.memory.readFloat32(SEG_DATA, base + 2 * CELL_SIZE);
    const p = fromTaggedValue(payload);
    const n = fromTaggedValue(entryName);
    expect(p.tag).toBe(Tag.BUILTIN);
    expect(p.value).toBe(7);
    expect(p.meta).toBe(1);
    expect(n.tag).toBe(Tag.STRING);
    expect(vm.digest.get(n.value)).toBe(name);
  });

  test('walks prev to find older entry', () => {
    // Define A then B; head should be B, prev should point to A
    symbols.defineBuiltin(vm, 'A', 11, false);
    symbols.defineBuiltin(vm, 'B', 22, false);
    // B is head
    let tv = symbols.findTaggedValue(vm, 'B');
    expect(tv).toBeDefined();
    let info = fromTaggedValue(tv!);
    expect(info.tag).toBe(Tag.BUILTIN);
    expect(info.value).toBe(22);
    // A is reachable via prev chain
    tv = symbols.findTaggedValue(vm, 'A');
    expect(tv).toBeDefined();
    info = fromTaggedValue(tv!);
    expect(info.tag).toBe(Tag.BUILTIN);
    expect(info.value).toBe(11);
  });
});
});
