/**
 * @file src/core/dictionary.ts
 * Heap-backed dictionary (core). Simple, C-like cell operations.
 *
 * Entry layout (LIST length 3): [prevRef, payloadTagged, name]
 * - prevRef: DATA_REF | NIL (previous entry header)
 * - payloadTagged: any tagged value (BUILTIN/CODE/LOCAL/DATA_REF/...)
 * - name: STRING (interned)
 */

import { VM } from './vm';
import { NIL, Tag, toTaggedValue, fromTaggedValue } from './tagged';
import { isList, getListLength } from './list';
import { CELL_SIZE, SEG_DATA, GLOBAL_BASE_CELLS } from './constants';
import { createGlobalRef, getByteAddressFromRef, getAbsoluteCellIndexFromRef, isRef } from './refs';

// Unified define: store a fully-formed tagged payload under an interned name
export function define(vm: VM, name: string, payloadTagged: number): void {
  const nameAddr = vm.digest.intern(name);
  const nameTagged = toTaggedValue(nameAddr, Tag.STRING);
  const prevRef = vm.head;
  vm.gpush(prevRef);
  vm.gpush(payloadTagged);
  vm.gpush(nameTagged);
  vm.gpush(toTaggedValue(3, Tag.LIST));
  vm.head = createGlobalRef(vm.gp - 1);
}

export function defineBuiltin(vm: VM, name: string, opcode: number, isImmediate = false): void {
  const tagged = toTaggedValue(opcode, Tag.BUILTIN, isImmediate ? 1 : 0);
  define(vm, name, tagged);
}

export function defineCode(vm: VM, name: string, address: number, isImmediate = false): void {
  const tagged = toTaggedValue(address, Tag.CODE, isImmediate ? 1 : 0);
  define(vm, name, tagged);
}

export function defineLocal(vm: VM, name: string): void {
  const slot = vm.localCount++;
  const tagged = toTaggedValue(slot, Tag.LOCAL);
  define(vm, name, tagged);
}

export function lookup(vm: VM, name: string): number {
  const PREV = 0;
  const PAYLOAD = 1;
  const NAME = 2;
  const SLOTS = 3;

  const target = vm.digest.intern(name);
  let cur = vm.head;

  while (cur !== NIL) {
    const hAddr = getByteAddressFromRef(cur);
    const hdr = vm.memory.readFloat32(SEG_DATA, hAddr);
    if (!isList(hdr) || getListLength(hdr) !== SLOTS) break;

    const base = hAddr - SLOTS * CELL_SIZE;
    const nameCell = vm.memory.readFloat32(SEG_DATA, base + NAME * CELL_SIZE);
    const ni = fromTaggedValue(nameCell);
    if (ni.tag === Tag.STRING && ni.value === target) {
      return vm.memory.readFloat32(SEG_DATA, base + PAYLOAD * CELL_SIZE);
    }

    const prev = vm.memory.readFloat32(SEG_DATA, base + PREV * CELL_SIZE);
    cur = isRef(prev) ? prev : NIL;
  }

  return NIL;
}

// Dictionary-scope checkpointing (ref-based)
export function mark(vm: VM): number {
  return createGlobalRef(vm.gp);
}

export function forget(vm: VM, markRef: number): void {
  const absIndex = getAbsoluteCellIndexFromRef(markRef);
  const gpNew = absIndex - GLOBAL_BASE_CELLS;
  if (!Number.isInteger(gpNew) || gpNew < 0) throw new Error('forget mark out of range');
  if (gpNew > vm.gp) throw new Error('forget mark beyond current heap top');
  vm.gp = gpNew;
  vm.head = vm.gp === 0 ? NIL : createGlobalRef(vm.gp - 1);
}
