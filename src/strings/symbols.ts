/**
 * @file src/strings/symbols.ts
 * Function-only, heap-only dictionary facade (C/Forth-style).
 * No classes, no closures, no JS state beyond numeric VM fields.
 *
 * Dictionary entry format (LIST length 3): [prevRef, payloadTagged, name]
 * - prevRef: DATA_REF | NIL to previous entry header
 * - payloadTagged: tagged value (BUILTIN/CODE/LOCAL/DATA_REF/etc.)
 * - name: STRING tagged value
 */

import { VM, NIL, Tag, toTaggedValue, fromTaggedValue, isList, isRef, isNIL, getListLength, createGlobalRef } from '@src/core';
import { CELL_SIZE, SEG_DATA, GLOBAL_BASE_CELLS } from '@src/core/constants';
import { getByteAddressFromRef, getAbsoluteCellIndexFromRef } from '@src/core/refs';

// Unified define (internal callers): accept a fully‑formed tagged payload and create an entry.
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

// Dictionary-scope checkpointing (ref-based):
// mark returns a DATA_REF to the next free global cell; forget restores gp from that ref.
export function mark(vm: VM): number {
  return createGlobalRef(vm.gp);
}

export function forget(vm: VM, markRef: number): void {
  // Expect a DATA_REF pointing within the global window
  const absIndex = getAbsoluteCellIndexFromRef(markRef);
  const gpNew = absIndex - GLOBAL_BASE_CELLS;
  if (!Number.isInteger(gpNew) || gpNew < 0) {
    throw new Error('forget mark out of range');
  }
  if (gpNew > vm.gp) {
    throw new Error('forget mark beyond current heap top');
  }
  vm.gp = gpNew;
  vm.head = vm.gp === 0 ? NIL : createGlobalRef(vm.gp - 1);
}

export function defineBuiltin(
  vm: VM,
  name: string,
  opcode: number,
  isImmediate = false,
): void {
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

export function lookup(vm: VM, name: string): number | undefined {
  const target = vm.digest.intern(name);
  let cur = vm.head;
  while (!isNIL(cur)) {
    const hAddr = getByteAddressFromRef(cur);
    const header = vm.memory.readFloat32(SEG_DATA, hAddr);
    if (!isList(header) || getListLength(header) !== 3) break;
    const base = hAddr - 3 * CELL_SIZE;
    const valueCell = vm.memory.readFloat32(SEG_DATA, base + 1 * CELL_SIZE);
    const entryName = vm.memory.readFloat32(SEG_DATA, base + 2 * CELL_SIZE);
    const ni = fromTaggedValue(entryName);
    if (ni.tag === Tag.STRING && ni.value === target) {
      // Return the stored tagged payload; maintain compatibility if older entries
      // stored a DATA_REF by dereferencing once.
      if (isRef(valueCell)) {
        const vAddr = getByteAddressFromRef(valueCell);
        return vm.memory.readFloat32(SEG_DATA, vAddr);
      }
      return valueCell;
    }
    const prevRef = vm.memory.readFloat32(SEG_DATA, base + 0 * CELL_SIZE);
    cur = isRef(prevRef) ? prevRef : NIL;
  }
  return undefined;
}

// Back-compat alias
export const findTaggedValue = lookup;

// Compatibility helpers
export function find(vm: VM, name: string): number | undefined {
  const t = lookup(vm, name);
  if (t === undefined) return undefined;
  const info = fromTaggedValue(t);
  if (info.tag === Tag.BUILTIN || info.tag === Tag.CODE) return info.value;
  return undefined;
}

export function findCodeRef(vm: VM, name: string): number | undefined {
  const t = lookup(vm, name);
  if (t === undefined) return undefined;
  const info = fromTaggedValue(t);
  if (info.tag === Tag.BUILTIN || info.tag === Tag.CODE) return t;
  return undefined;
}

export function findBytecodeAddress(vm: VM, name: string): number | undefined {
  const t = lookup(vm, name);
  if (t === undefined) return undefined;
  const info = fromTaggedValue(t);
  if (info.tag === Tag.CODE) return info.value;
  return undefined;
}

export interface SymbolEntry {
  taggedValue: number;
  isImmediate: boolean;
}

export function findEntry(vm: VM, name: string): SymbolEntry | undefined {
  const t = lookup(vm, name);
  if (t === undefined) return undefined;
  const info = fromTaggedValue(t);
  return { taggedValue: t, isImmediate: info.meta === 1 };
}

export function findWithImplementation(
  vm: VM,
  name: string,
): { index: number; isImmediate: boolean } | undefined {
  const t = lookup(vm, name);
  if (t === undefined) return undefined;
  const info = fromTaggedValue(t);
  return { index: info.value, isImmediate: info.meta === 1 };
}
