/**
 * @file src/core/dictionary.ts
 * Heap-backed dictionary (core). Simple, C-like cell operations.
 *
 * Entry layout (LIST length 3): [prevRef, payloadTagged, name]
 * - prevRef: REF to previous entry header, or NIL (end of chain)
 * - payloadTagged: any tagged value (BUILTIN/CODE/LOCAL/REF/...)
 * - name: STRING (interned)
 *
 * Head is stored as a cell index (like gp), with 0 meaning empty dictionary.
 */

import type { VM } from './vm';
import {
  NIL,
  Tag,
  toTaggedValue,
  fromTaggedValue,
  isString,
  isNumber as isNumberTagged,
  isNIL,
} from './tagged';
import { isList, getListLength, validateListHeader } from './list';
import { isRef, createGlobalRef, decodeRef } from './refs';
import { pushListToGlobalHeap, pushSimpleToGlobalHeap } from './global-heap';
import { CELL_SIZE, SEG_DATA, GLOBAL_BASE_BYTES, GLOBAL_BASE_CELLS } from './constants';
import { gpush, peekAt, push, pop, peek, ensureStackSize } from './vm';

// Helper to get byte address from cell index (relative to GLOBAL_BASE_CELLS)
function getByteAddressFromCellIndex(cellIndex: number): number {
  return GLOBAL_BASE_BYTES + cellIndex * CELL_SIZE;
}

// Unified define: store a fully-formed tagged payload under an interned name
export function define(vm: VM, name: string, payloadTagged: number): void {
  const nameAddr = vm.digest.intern(name);
  const nameTagged = toTaggedValue(nameAddr, Tag.STRING);
  // Create prevRef as REF (or NIL if head is 0)
  const prevRef = vm.head === 0 ? NIL : createGlobalRef(vm.head);
  gpush(vm, prevRef);
  gpush(vm, payloadTagged);
  gpush(vm, nameTagged);
  gpush(vm, toTaggedValue(3, Tag.LIST));
  // head is now the cell index of the header (gp - 1 is relative to GLOBAL_BASE_CELLS)
  vm.head = vm.gp - 1;
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
  let cur = vm.head; // cell index (0 = NIL)

  while (cur !== 0) {
    const hAddr = getByteAddressFromCellIndex(cur);
    const hdr = vm.memory.readFloat32(SEG_DATA, hAddr);
    if (!isList(hdr) || getListLength(hdr) !== SLOTS) {
      break;
    }

    const base = hAddr - SLOTS * CELL_SIZE;
    const nameCell = vm.memory.readFloat32(SEG_DATA, base + NAME * CELL_SIZE);
    const ni = fromTaggedValue(nameCell);
    if (ni.tag === Tag.STRING && ni.value === target) {
      return vm.memory.readFloat32(SEG_DATA, base + PAYLOAD * CELL_SIZE);
    }

    const prevRefValue = vm.memory.readFloat32(SEG_DATA, base + PREV * CELL_SIZE);
    // prevRef is stored as REF (or NIL)
    if (isNIL(prevRefValue)) {
      cur = 0;
    } else {
      const { tag } = fromTaggedValue(prevRefValue);
      if (tag === Tag.REF) {
        const { absoluteCellIndex } = decodeRef(prevRefValue);
        // Convert absolute cell index back to relative (relative to GLOBAL_BASE_CELLS)
        cur = absoluteCellIndex - GLOBAL_BASE_CELLS;
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
  const info = fromTaggedValue(result);
  if (info.tag === Tag.CODE) {
    return info.value;
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
  const info = fromTaggedValue(result);
  return { taggedValue: result, isImmediate: info.meta === 1 };
}

export function forget(vm: VM, markCellIndex: number): void {
  // markCellIndex is a NUMBER (cell index relative to GLOBAL_BASE_CELLS)
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
    const header = peek(vm);
    const n = getListLength(header);
    const baseCell = vm.sp - 1 - n;
    const baseAddrBytes = baseCell * CELL_SIZE;
    const ref = pushListToGlobalHeap(vm, { header, baseAddrBytes });
    // Drop the original list from the data stack
    for (let i = 0; i < n + 1; i++) {
      pop(vm);
    }
    return ref;
  }
  // Simple scalar: copy one cell to heap and consume it from stack
  const ref = pushSimpleToGlobalHeap(vm, value);
  return ref;
}

// Build a LIST entry [prevRef, valueRef, name] on data stack and copy to global heap.
// Returns cell index of the header (relative to GLOBAL_BASE_CELLS)
function pushEntryToHeap(vm: VM, prevCell: number, valueRef: number, name: number): number {
  // Create prevRef as REF (or NIL if prevCell is 0)
  const prevRef = prevCell === 0 ? NIL : createGlobalRef(prevCell);
  // Payload order: prevRef (as REF or NIL), valueRef, name, then LIST header of length 3
  push(vm, prevRef);
  push(vm, valueRef);
  push(vm, name);
  const header = toTaggedValue(3, Tag.LIST);
  push(vm, header);
  const baseCell = vm.sp - 1 - 3;
  const baseAddrBytes = baseCell * CELL_SIZE;
  pushListToGlobalHeap(vm, { header, baseAddrBytes });
  validateListHeader(vm);
  // Remove temporary list from data stack
  for (let i = 0; i < 4; i++) {
    pop(vm);
  }
  // Header is at gp - 1 after push
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

  // Pop name to expose value (especially for LIST path)
  pop(vm);

  let valueRef: number;
  if (isList(value)) {
    valueRef = materializeValueRef(vm, value);
  } else if (isRef(value)) {
    // Remove original value from stack
    pop(vm);
    valueRef = value;
  } else {
    valueRef = pushSimpleToGlobalHeap(vm, value);
    // Remove original value from stack
    pop(vm);
  }

  // Build entry list and update new dictionary head
  const prevCell = vm.head; // cell index (0 = NIL)
  const headerCellIndex = pushEntryToHeap(vm, prevCell, valueRef, name);
  vm.head = headerCellIndex; // Store cell index, not ref
}

// lookup: ( name — ref|NIL )
export function lookupOp(vm: VM): void {
  ensureStackSize(vm, 1, 'lookup');
  const name = pop(vm);
  if (!isString(name)) {
    throw new Error('lookup expects STRING name');
  }

  const nameStr = vm.digest.get(fromTaggedValue(name).value);
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
    const hAddr = getByteAddressFromCellIndex(cur);
    const header = vm.memory.readFloat32(SEG_DATA, hAddr);
    if (!isList(header) || getListLength(header) !== 3) {
      break;
    }
    const base = hAddr - 3 * CELL_SIZE;
    const prevRefValue = vm.memory.readFloat32(SEG_DATA, base + 0 * CELL_SIZE);
    const _valueRef = vm.memory.readFloat32(SEG_DATA, base + 1 * CELL_SIZE);
    const entryName = vm.memory.readFloat32(SEG_DATA, base + 2 * CELL_SIZE);
    const nameInfo = fromTaggedValue(entryName);
    const nameStr =
      nameInfo.tag === Tag.STRING ? vm.digest.get(nameInfo.value) : `?tag:${nameInfo.tag}`;
    let prevStr = 'NIL';
    if (!isNIL(prevRefValue)) {
      const { tag } = fromTaggedValue(prevRefValue);
      if (tag === Tag.REF) {
        const { absoluteCellIndex } = decodeRef(prevRefValue);
        const relativeCellIndex = absoluteCellIndex - GLOBAL_BASE_CELLS;
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
      const { tag } = fromTaggedValue(prevRefValue);
      if (tag === Tag.REF) {
        const { absoluteCellIndex } = decodeRef(prevRefValue);
        cur = absoluteCellIndex - GLOBAL_BASE_CELLS;
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
