/**
 * @file src/core/dictionary.ts
 * Heap-backed dictionary (core). Simple, C-like cell operations.
 *
 * Entry layout (LIST length 3): [prevRef, payloadTagged, name]
 * - prevRef: REF to previous entry header, or NIL (end of chain)
 * - payloadTagged: any tagged value (CODE/LOCAL/REF/...)
 * - name: STRING (interned)
 *
 * Head is stored as a cell index (like gp), with 0 meaning empty dictionary.
 */

import {
  NIL,
  Tag,
  Tagged,
  getTaggedInfo,
  type TaggedInfo,
  isString,
  isNumber as isNumberTagged,
  isNIL,
} from './tagged';
import { decodeX1516 } from './code-ref';
import { isList, getListLength, validateListHeader } from './list';
import { isRef, createGlobalRef, getCellFromRef } from './refs';
import { gpushListFrom, gpushVal } from './global-heap';
import { GLOBAL_BASE } from './constants';
import { type VM, gpush, peekAt, push, pop, peek, ensureStackSize } from './vm';
import { memoryReadCell, memoryWriteCell } from './memory';
import { digestGet, digestIntern } from '../strings/digest';

const ENTRY_PREV = 0;
const ENTRY_PAYLOAD = 1;
const ENTRY_NAME = 2;
const ENTRY_SLOTS = 3;

function getEntryBaseCell(entryCellIndex: number): number {
  return entryCellIndex - ENTRY_SLOTS;
}

function setEntryNameMeta(vm: VM, entryCellIndex: number, meta: 0 | 1): void {
  if (entryCellIndex === 0) {
    throw new Error('Cannot adjust meta bit on empty dictionary');
  }
  const baseCell = getEntryBaseCell(entryCellIndex);
  const nameCellIndex = baseCell + ENTRY_NAME;
  const current = memoryReadCell(vm.memory, nameCellIndex);
  const info = getTaggedInfo(current);
  if (info.tag !== Tag.STRING) {
    throw new Error('Dictionary entry name must be STRING');
  }
  if (info.meta === meta) {
    return;
  }
  const updated = Tagged(info.value, Tag.STRING, meta);
  memoryWriteCell(vm.memory, nameCellIndex, updated);
}

function getEntryNameInfo(vm: VM, entryCellIndex: number): TaggedInfo {
  const baseCell = getEntryBaseCell(entryCellIndex);
  const nameCellIndex = baseCell + ENTRY_NAME;
  const current = memoryReadCell(vm.memory, nameCellIndex);
  return getTaggedInfo(current);
}

function getEntryPayload(vm: VM, entryCellIndex: number): number {
  const baseCell = getEntryBaseCell(entryCellIndex);
  const payloadCellIndex = baseCell + ENTRY_PAYLOAD;
  return memoryReadCell(vm.memory, payloadCellIndex);
}

export function hideDictionaryHead(vm: VM): void {
  if (vm.head === 0) {
    throw new Error('Cannot hide head: dictionary is empty');
  }
  setEntryNameMeta(vm, vm.head, 1);
}

export function unhideDictionaryHead(vm: VM): void {
  if (vm.head === 0) {
    throw new Error('Cannot unhide head: dictionary is empty');
  }
  setEntryNameMeta(vm, vm.head, 0);
}

export function getDictionaryEntryInfo(
  vm: VM,
  entryCellIndex: number,
): { payload: number; hidden: boolean; nameAddr: number; name: string } {
  if (entryCellIndex === 0) {
    throw new Error('Dictionary entry index 0 is not valid');
  }
  const nameInfo = getEntryNameInfo(vm, entryCellIndex);
  if (nameInfo.tag !== Tag.STRING) {
    throw new Error('Dictionary entry name must be STRING');
  }
  const payload = getEntryPayload(vm, entryCellIndex);
  const nameAddr = nameInfo.value;
  const name = digestGet(vm.digest, nameAddr);
  return {
    payload,
    hidden: nameInfo.meta === 1,
    nameAddr,
    name,
  };
}

export function getDictionaryHeadInfo(
  vm: VM,
): { payload: number; hidden: boolean; nameAddr: number; name: string } | undefined {
  if (vm.head === 0) {
    return undefined;
  }
  return getDictionaryEntryInfo(vm, vm.head);
}

// Unified define: store a fully-formed tagged payload under an interned name
export function define(vm: VM, name: string, payloadTagged: number): void {
  const nameAddr = digestIntern(vm.digest, name);
  const nameTagged = Tagged(nameAddr, Tag.STRING);
  // Create prevRef as REF (or NIL if head is 0)
  const prevRef = vm.head === 0 ? NIL : createGlobalRef(vm.head);
  gpush(vm, prevRef);
  gpush(vm, payloadTagged);
  gpush(vm, nameTagged);
  gpush(vm, Tagged(3, Tag.LIST));
  // head is now the cell index of the header (gp - 1 is relative to GLOBAL_BASE)
  vm.head = vm.gp - 1;
}

export function lookup(vm: VM, name: string): number {
  const target = digestIntern(vm.digest, name);
  let cur = vm.head; // cell index (0 = NIL)

  while (cur !== 0) {
    const hdr = memoryReadCell(vm.memory, cur);
    if (!isList(hdr) || getListLength(hdr) !== ENTRY_SLOTS) {
      break;
    }

    const baseCell = getEntryBaseCell(cur);
    const nameCell = memoryReadCell(vm.memory, baseCell + ENTRY_NAME);
    const ni = getTaggedInfo(nameCell);
    if (ni.meta === 0 && ni.tag === Tag.STRING && ni.value === target) {
      return memoryReadCell(vm.memory, baseCell + ENTRY_PAYLOAD);
    }

    const prevRefValue = memoryReadCell(vm.memory, baseCell + ENTRY_PREV);
    // prevRef is stored as REF (or NIL)
    if (isNIL(prevRefValue)) {
      cur = 0;
    } else {
      const { tag } = getTaggedInfo(prevRefValue);
      if (tag === Tag.REF) {
        const cellIndex = getCellFromRef(prevRefValue);
        cur = cellIndex - GLOBAL_BASE;
      } else {
        cur = 0;
      }
    }
  }

  return NIL;
}

// Dictionary-scope checkpointing (cell-index based)
export function mark(vm: VM): number {
  // Return cell index as a NUMBER (for backward compatibility with forget)
  return vm.gp;
}

// Mark with localCount reset (needed for function definitions)
export function markWithLocalReset(vm: VM): number {
  vm.localCount = 0;
  return mark(vm);
}

// Helper functions for test compatibility (not used in actual code)
export function findBytecodeAddress(vm: VM, name: string): number | undefined {
  const result = lookup(vm, name);
  if (isNIL(result)) {
    return undefined;
  }
  const info = getTaggedInfo(result);
  if (info.tag === Tag.CODE) {
    // Decode X1516 encoded address to return the actual bytecode address
    return decodeX1516(info.value);
  }
  return undefined;
}

export function findEntry(
  vm: VM,
  name: string,
): { taggedValue: number; isImmediate: boolean } | undefined {
  const result = lookup(vm, name);
  if (isNIL(result)) {
    return undefined;
  }
  const info = getTaggedInfo(result);
  return { taggedValue: result, isImmediate: info.meta === 1 };
}

export function forget(vm: VM, markCellIndex: number): void {
  // markCellIndex is a NUMBER (cell index relative to GLOBAL_BASE)
  const gpNew = markCellIndex;
  if (!Number.isInteger(gpNew) || gpNew < 0) {
    throw new Error('forget mark out of range');
  }
  if (gpNew > vm.gp) {
    throw new Error('forget mark beyond current heap top');
  }
  vm.gp = gpNew;
  // Update head to point to the most recent entry, or 0 if heap is empty
  vm.head = vm.gp === 0 ? 0 : vm.gp - 1;
}

// ============================================================================
// VM Operation Handlers (stack-based interface)
// ============================================================================

// Helper to materialize a value from stack to heap as REF
function materializeValueRef(vm: VM, value: number): number {
  if (isRef(value)) {
    return value;
  }
  if (isList(value)) {
    validateListHeader(vm);
    const h = peek(vm);
    const n = getListLength(h);
    const base = vm.sp - 1 - n;
    const ref = gpushListFrom(vm, { header: h, baseCell: base });
    for (let i = 0; i < n + 1; i++) {
      pop(vm);
    }
    return ref;
  }
  return gpushVal(vm, value);
}

function pushEntryToHeap(vm: VM, prev: number, val: number, name: number): number {
  const prevRef = prev === 0 ? NIL : createGlobalRef(prev);
  push(vm, prevRef);
  push(vm, val);
  push(vm, name);
  const h = Tagged(3, Tag.LIST);
  push(vm, h);
  const base = vm.sp - 1 - 3;
  gpushListFrom(vm, { header: h, baseCell: base });
  validateListHeader(vm);
  for (let i = 0; i < 4; i++) {
    pop(vm);
  }
  return vm.gp - 1;
}

// define: ( value name — )
export function defineOp(vm: VM): void {
  ensureStackSize(vm, 2, 'define');
  const name = peek(vm);
  if (!isString(name)) {
    throw new Error('define expects STRING name');
  }
  const value = peekAt(vm, 1);

  pop(vm);

  let valRef: number;
  if (isList(value)) {
    valRef = materializeValueRef(vm, value);
  } else if (isRef(value)) {
    pop(vm);
    valRef = value;
  } else {
    valRef = gpushVal(vm, value);
    pop(vm);
  }

  const prev = vm.head;
  const hdr = pushEntryToHeap(vm, prev, valRef, name);
  vm.head = hdr;
}

// lookup: ( name — ref|NIL )
export function lookupOp(vm: VM): void {
  ensureStackSize(vm, 1, 'lookup');
  const name = pop(vm);
  if (!isString(name)) {
    throw new Error('lookup expects STRING name');
  }

  const nameStr = digestGet(vm.digest, getTaggedInfo(name).value);
  const result = lookup(vm, nameStr);
  push(vm, result);
}

// mark: ( — cellIndex )
// Returns cell index (NUMBER) as mark, not a ref
export function markOp(vm: VM): void {
  push(vm, mark(vm)); // Push cell index as NUMBER
}

// forget: ( cellIndex — )
// Accepts cell index (NUMBER) as mark
export function forgetOp(vm: VM): void {
  ensureStackSize(vm, 1, 'forget');
  const markCellIndex = pop(vm);
  if (!isNumberTagged(markCellIndex)) {
    throw new Error('forget expects NUMBER (cell index)');
  }
  forget(vm, markCellIndex);
}

// Dict-first lookup toggles (no stack effect)
// No-op: dictionary is now the only lookup source
export function dictFirstOnOp(_vm: VM): void {
  // Dictionary is always the lookup source
}

export function dictFirstOffOp(_vm: VM): void {
  // Dictionary is always the lookup source
}

// Debug: dump heap-backed dictionary
export function dumpDictOp(vm: VM): void {
  const lines: string[] = [];
  let cur = vm.head; // cell index (0 = NIL)
  let i = 0;
  while (cur !== 0) {
    const header = memoryReadCell(vm.memory, cur);
    if (!isList(header) || getListLength(header) !== 3) {
      break;
    }
    const baseCell = cur - 3;
    const prevRefValue = memoryReadCell(vm.memory, baseCell + 0);
    const _valueRef = memoryReadCell(vm.memory, baseCell + 1);
    const entryName = memoryReadCell(vm.memory, baseCell + 2);
    const nameInfo = getTaggedInfo(entryName);
    const nameStr =
      nameInfo.tag === Tag.STRING ? digestGet(vm.digest, nameInfo.value) : `?tag:${nameInfo.tag}`;
    let prevStr = 'NIL';
    if (!isNIL(prevRefValue)) {
      const { tag } = getTaggedInfo(prevRefValue);
      if (tag === Tag.REF) {
        const cellIndex = getCellFromRef(prevRefValue);
        const relativeCellIndex = cellIndex - GLOBAL_BASE;
        prevStr = `cell@${relativeCellIndex}`;
      } else {
        prevStr = `?tag:${tag}`;
      }
    }
    lines.push(`${i}: ${nameStr} -> prev:${prevStr} headerCell:${cur}`);
    // Decode prevRef to get next cell index
    if (isNIL(prevRefValue)) {
      cur = 0;
    } else {
      const { tag } = getTaggedInfo(prevRefValue);
      if (tag === Tag.REF) {
        const cellIndex = getCellFromRef(prevRefValue);
        cur = cellIndex - GLOBAL_BASE;
      } else {
        cur = 0;
      }
    }
    i++;
  }
  // Print from head to tail
  if (lines.length === 0) {
    // eslint-disable-next-line no-console
    console.log('[dict] (empty)');
  } else {
    // eslint-disable-next-line no-console
    console.log(`[dict]\n${lines.join('\n')}`);
  }
}
