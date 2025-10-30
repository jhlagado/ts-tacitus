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
import { CELL_SIZE, SEG_DATA } from '@src/core/constants';
import { getByteAddressFromRef } from '@src/core/refs';

// Internal: build entry by pushing 3 payload cells then LIST:3 header; updates vm.newDictHead.
function pushEntry(vm: VM, payloadTagged: number, nameTagged: number): void {
  const prevRef = vm.newDictHead ?? NIL;
  vm.gpush(prevRef);
  vm.gpush(payloadTagged);
  vm.gpush(nameTagged);
  vm.gpush(toTaggedValue(3, Tag.LIST));
  // header is top (gp-1): update dictionary head
  vm.newDictHead = createGlobalRef(vm.gp - 1);
}

// Optional convenience for call sites that prefer (name, payload) ordering.
function addEntry(vm: VM, nameTagged: number, payloadTagged: number): void {
  pushEntry(vm, payloadTagged, nameTagged);
}

// Dictionary-scope checkpointing (numeric-only):
// mark returns the current gp (cells used). We assume calls occur when the
// current top (gp-1) is a dictionary header. forget restores gp and head.
export function mark(vm: VM): number {
  return vm.gp;
}

export function forget(vm: VM, markCells: number): void {
  if (!Number.isInteger(markCells) || markCells < 0 || markCells > vm.gp) {
    throw new Error('forget: mark out of range');
  }
  vm.gp = markCells;
  // If heap is now empty, clear head; otherwise head is the header at gp-1.
  vm.newDictHead = vm.gp === 0 ? NIL : createGlobalRef(vm.gp - 1);
}

export function defineBuiltin(
  vm: VM,
  name: string,
  opcode: number,
  isImmediate = false,
): void {
  const nameAddr = vm.digest.intern(name);
  const nameTagged = toTaggedValue(nameAddr, Tag.STRING);
  const tagged = toTaggedValue(opcode, Tag.BUILTIN, isImmediate ? 1 : 0);
  pushEntry(vm, tagged, nameTagged);
}

export function defineCode(vm: VM, name: string, address: number, isImmediate = false): void {
  const nameAddr = vm.digest.intern(name);
  const nameTagged = toTaggedValue(nameAddr, Tag.STRING);
  const tagged = toTaggedValue(address, Tag.CODE, isImmediate ? 1 : 0);
  pushEntry(vm, tagged, nameTagged);
}

export function defineLocal(vm: VM, name: string): void {
  const slot = vm.localCount++;
  const nameAddr = vm.digest.intern(name);
  const nameTagged = toTaggedValue(nameAddr, Tag.STRING);
  const tagged = toTaggedValue(slot, Tag.LOCAL);
  pushEntry(vm, tagged, nameTagged);
}

// Unified define (internal callers): accept a fully‑formed tagged payload and create an entry.
export function defineEntry(vm: VM, name: string, payloadTagged: number): void {
  const nameAddr = vm.digest.intern(name);
  const nameTagged = toTaggedValue(nameAddr, Tag.STRING);
  pushEntry(vm, payloadTagged, nameTagged);
}

export function findTaggedValue(vm: VM, name: string): number | undefined {
  const target = vm.digest.intern(name);
  let cur = vm.newDictHead;
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

// Compatibility helpers
export function find(vm: VM, name: string): number | undefined {
  const t = findTaggedValue(vm, name);
  if (t === undefined) return undefined;
  const info = fromTaggedValue(t);
  if (info.tag === Tag.BUILTIN || info.tag === Tag.CODE) return info.value;
  return undefined;
}

export function findCodeRef(vm: VM, name: string): number | undefined {
  const t = findTaggedValue(vm, name);
  if (t === undefined) return undefined;
  const info = fromTaggedValue(t);
  if (info.tag === Tag.BUILTIN || info.tag === Tag.CODE) return t;
  return undefined;
}

export function findBytecodeAddress(vm: VM, name: string): number | undefined {
  const t = findTaggedValue(vm, name);
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
  const t = findTaggedValue(vm, name);
  if (t === undefined) return undefined;
  const info = fromTaggedValue(t);
  return { taggedValue: t, isImmediate: info.meta === 1 };
}

export function findWithImplementation(
  vm: VM,
  name: string,
): { index: number; isImmediate: boolean } | undefined {
  const t = findTaggedValue(vm, name);
  if (t === undefined) return undefined;
  const info = fromTaggedValue(t);
  return { index: info.value, isImmediate: info.meta === 1 };
}
