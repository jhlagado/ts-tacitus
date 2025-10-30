/**
 * @file src/strings/symbols.ts
 * Function-only, heap-only dictionary facade (C/Forth-style).
 * No classes, no closures, no JS state beyond numeric VM fields.
 *
 * Dictionary entry format (LIST length 3): [prevRef, valueRef, name]
 * - prevRef: DATA_REF | NIL to previous entry header
 * - valueRef: DATA_REF to value cell (tagged simple or LIST header)
 * - name: STRING tagged value
 */

import {
  VM,
  NIL,
  Tag,
  toTaggedValue,
  fromTaggedValue,
  isList,
  isRef,
  isNIL,
  getListLength,
  pushListToGlobalHeap,
  pushSimpleToGlobalHeap,
  createGlobalRef,
} from '@src/core';
import { CELL_SIZE, SEG_DATA, GLOBAL_BASE } from '@src/core/constants';
import { getByteAddressFromRef } from '@src/core/refs';

// Internal: build entry by pushing 3 payload cells then LIST:3 header onto the global window.
// Returns a DATA_REF to the header cell (TOS of the entry on the heap).
function pushEntry(vm: VM, prevRef: number, valueRef: number, nameTagged: number): number {
  vm.gpush(prevRef);
  vm.gpush(valueRef);
  vm.gpush(nameTagged);
  vm.gpush(toTaggedValue(3, Tag.LIST));
  // header is the last pushed cell; gp is one past top
  return createGlobalRef(vm.gp - 1);
}

// Internal: ensure value is stored on heap and return DATA_REF to it
function toValueRef(vm: VM, taggedValue: number): number {
  if (isRef(taggedValue)) return taggedValue;
  if (isList(taggedValue)) {
    const n = getListLength(taggedValue);
    const baseCell = vm.sp - 1 - n;
    const baseAddr = baseCell * CELL_SIZE;
    const ref = pushListToGlobalHeap(vm, { header: taggedValue, baseAddrBytes: baseAddr });
    // Drop original list from stack (payload + header)
    for (let i = 0; i < n + 1; i++) vm.pop();
    return ref;
  }
  return pushSimpleToGlobalHeap(vm, taggedValue);
}

export interface DictCheckpoint {
  gp: number;
  newDictHead: number;
}

export function mark(vm: VM): DictCheckpoint {
  return { gp: vm.gp, newDictHead: vm.newDictHead };
}

export function revert(vm: VM, cp: DictCheckpoint): void {
  vm.gp = cp.gp;
  vm.newDictHead = cp.newDictHead;
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
  const valueRef = toValueRef(vm, tagged);
  const prev = vm.newDictHead ?? NIL;
  const entryRef = pushEntry(vm, prev, valueRef, nameTagged);
  vm.newDictHead = entryRef;
}

export function defineCode(vm: VM, name: string, address: number, isImmediate = false): void {
  const nameAddr = vm.digest.intern(name);
  const nameTagged = toTaggedValue(nameAddr, Tag.STRING);
  const tagged = toTaggedValue(address, Tag.CODE, isImmediate ? 1 : 0);
  const valueRef = toValueRef(vm, tagged);
  const prev = vm.newDictHead ?? NIL;
  const entryRef = pushEntry(vm, prev, valueRef, nameTagged);
  vm.newDictHead = entryRef;
}

export function defineLocal(vm: VM, name: string): void {
  const slot = vm.localCount++;
  const nameAddr = vm.digest.intern(name);
  const nameTagged = toTaggedValue(nameAddr, Tag.STRING);
  const tagged = toTaggedValue(slot, Tag.LOCAL);
  const valueRef = toValueRef(vm, tagged);
  const prev = vm.newDictHead ?? NIL;
  const entryRef = pushEntry(vm, prev, valueRef, nameTagged);
  vm.newDictHead = entryRef;
}

// Unified define (internal callers): accept a fully‑formed tagged payload and create an entry.
export function defineEntry(vm: VM, name: string, payloadTagged: number): void {
  const nameAddr = vm.digest.intern(name);
  const nameTagged = toTaggedValue(nameAddr, Tag.STRING);
  const valueRef = toValueRef(vm, payloadTagged);
  const prev = vm.newDictHead ?? NIL;
  const entryRef = pushEntry(vm, prev, valueRef, nameTagged);
  vm.newDictHead = entryRef;
}

export function findTaggedValue(vm: VM, name: string): number | undefined {
  const target = vm.digest.intern(name);
  let cur = vm.newDictHead;
  while (!isNIL(cur)) {
    const hAddr = getByteAddressFromRef(cur);
    const header = vm.memory.readFloat32(SEG_DATA, hAddr);
    if (!isList(header) || getListLength(header) !== 3) break;
    const base = hAddr - 3 * CELL_SIZE;
    const valueRef = vm.memory.readFloat32(SEG_DATA, base + 1 * CELL_SIZE);
    const entryName = vm.memory.readFloat32(SEG_DATA, base + 2 * CELL_SIZE);
    const ni = fromTaggedValue(entryName);
    if (ni.tag === Tag.STRING && ni.value === target) {
      // Deref valueRef and return the stored tagged value (or DATA_REF if desired by caller)
      const vAddr = getByteAddressFromRef(valueRef);
      return vm.memory.readFloat32(SEG_DATA, vAddr);
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
