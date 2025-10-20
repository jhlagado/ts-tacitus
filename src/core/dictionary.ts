/**
 * @file src/core/dictionary.ts
 * Heap-backed dictionary helpers built on Tacit's global arena.
 *
 * These routines operate exclusively on VM registers (`dictHead`, `GP`,
 * `dictLocalSlots`) and the global heap primitives. They do not touch the
 * in-memory symbol table, allowing the legacy table to coexist until callers
 * migrate to the heap-backed dictionary.
 */

import { VM } from './vm';
import { Tag, NIL, toTaggedValue, fromTaggedValue, getTag, isNIL } from './tagged';
import { pushDictionaryEntry } from './global-heap';
import { decodeDataRef, createDataRef } from './refs';
import { CELL_SIZE, SEG_GLOBAL } from './constants';

export interface DictionaryCheckpoint {
  dictHead: number;
  gp: number;
  localSlots: number;
}

export interface DictionaryEntry {
  entryRef: number;
  payloadRef: number;
  payload: number;
  name: number;
  prev: number;
}

function ensureDictionaryEntryRef(entryRef: number): {
  segment: number;
  headerCellIndex: number;
} {
  const { segment, cellIndex } = decodeDataRef(entryRef);
  if (segment !== SEG_GLOBAL) {
    throw new Error('Dictionary entry must live on the global heap');
  }
  return { segment, headerCellIndex: cellIndex };
}

function readEntry(vm: VM, entryRef: number, payloadRefOverride?: number): DictionaryEntry {
  const { segment, headerCellIndex } = ensureDictionaryEntryRef(entryRef);
  const payload = vm.memory.readFloat32(segment, (headerCellIndex - 3) * CELL_SIZE);
  const name = vm.memory.readFloat32(segment, (headerCellIndex - 2) * CELL_SIZE);
  const prev = vm.memory.readFloat32(segment, (headerCellIndex - 1) * CELL_SIZE);
  const payloadCellIndex = headerCellIndex - 3;
  const payloadRef = payloadRefOverride ?? createDataRef(segment, payloadCellIndex);
  return { entryRef, payloadRef, payload, name, prev };
}

function internName(nameOffset: number): number {
  if (!Number.isInteger(nameOffset) || nameOffset < 0 || nameOffset > 0xffff) {
    throw new Error(`Invalid string offset for dictionary entry: ${nameOffset}`);
  }
  return toTaggedValue(nameOffset, Tag.STRING);
}

function defineEntry(vm: VM, nameOffset: number, payload: number): DictionaryEntry {
  const nameTagged = internName(nameOffset);
  const prev = vm.dictHead ?? NIL;
  const { entryRef, payloadRef } = pushDictionaryEntry(vm, payload, nameTagged, prev);
  if (process.env.NODE_ENV === 'test') {
    // eslint-disable-next-line no-console
    console.log('defineEntry push', { prev, entryRef: decodeRefDebug(entryRef) });
  }
  vm.dictHead = entryRef;
  return readEntry(vm, entryRef, payloadRef);
}

function decodeRefDebug(ref: number) {
  try {
    const info = decodeDataRef(ref);
    return { segment: info.segment, cellIndex: info.cellIndex };
  } catch {
    return null;
  }
}

export function dictInit(vm: VM): void {
  vm.dictHead = NIL;
  vm.dictLocalSlots = 0;
}

export function dictMark(vm: VM): DictionaryCheckpoint {
  const checkpoint: DictionaryCheckpoint = {
    dictHead: vm.dictHead,
    gp: vm.GP,
    localSlots: vm.dictLocalSlots,
  };
  vm.dictLocalSlots = 0;
  return checkpoint;
}

export function dictRevert(vm: VM, checkpoint: DictionaryCheckpoint): void {
  vm.dictHead = checkpoint.dictHead;
  vm.GP = checkpoint.gp;
  vm.dictLocalSlots = checkpoint.localSlots;
}

export function dictDefineBuiltin(
  vm: VM,
  nameOffset: number,
  opcode: number,
  isImmediate = false,
): DictionaryEntry {
  if (!Number.isInteger(opcode) || opcode < 0 || opcode > 0xffff) {
    throw new Error(`Invalid builtin opcode: ${opcode}`);
  }
  const payload = toTaggedValue(opcode, Tag.BUILTIN, isImmediate ? 1 : 0);
  return defineEntry(vm, nameOffset, payload);
}

export function dictDefineCode(
  vm: VM,
  nameOffset: number,
  address: number,
  isImmediate = false,
): DictionaryEntry {
  if (!Number.isInteger(address) || address < 0 || address > 0xffff) {
    throw new Error(`Invalid code address: ${address}`);
  }
  const payload = toTaggedValue(address, Tag.CODE, isImmediate ? 1 : 0);
  return defineEntry(vm, nameOffset, payload);
}

export function dictDefineGlobal(vm: VM, nameOffset: number, dataRef: number): DictionaryEntry {
  if (getTag(dataRef) !== Tag.DATA_REF) {
    throw new Error('Global dictionary payload must be a DATA_REF');
  }
  return defineEntry(vm, nameOffset, dataRef);
}

export function dictDefineLocal(vm: VM, nameOffset: number): DictionaryEntry {
  const slot = vm.dictLocalSlots;
  if (slot < 0 || slot > 0xffff) {
    throw new Error('Local slot counter overflow');
  }
  vm.dictLocalSlots += 1;
  const payload = toTaggedValue(slot, Tag.LOCAL);
  return defineEntry(vm, nameOffset, payload);
}

export function dictLookupEntry(vm: VM, nameOffset: number): DictionaryEntry | undefined {
  if (isNIL(vm.dictHead)) {
    return undefined;
  }

  let currentRef = vm.dictHead;

  while (!isNIL(currentRef)) {
    const entry = readEntry(vm, currentRef);
    const nameInfo = fromTaggedValue(entry.name);
    if (nameInfo.tag === Tag.STRING && nameInfo.value === nameOffset) {
      return entry;
    }

    const prevInfo = fromTaggedValue(entry.prev);
    if (prevInfo.tag === Tag.SENTINEL && prevInfo.value === 0) {
      break;
    }
    if (prevInfo.tag !== Tag.DATA_REF) {
      throw new Error('Dictionary entry has malformed prev pointer');
    }
    currentRef = entry.prev;
  }

  return undefined;
}

export function dictLookup(vm: VM, nameOffset: number): number | undefined {
  const entry = dictLookupEntry(vm, nameOffset);
  return entry?.payload;
}

export function dictGetEntryRef(vm: VM, nameOffset: number): number | undefined {
  const entry = dictLookupEntry(vm, nameOffset);
  return entry?.entryRef;
}
