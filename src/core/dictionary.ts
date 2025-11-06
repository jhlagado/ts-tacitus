/**
 * @file src/core/dictionary.ts
 * Heap-backed dictionary (core). Simple, C-like cell operations.
 *
 * Entry layout (LIST length 3): [prevCell, payloadTagged, name]
 * - prevCell: cell index (number) to previous entry header, 0 = NIL (end of chain)
 * - payloadTagged: any tagged value (BUILTIN/CODE/LOCAL/DATA_REF/...)
 * - name: STRING (interned)
 *
 * Head is stored as a cell index (like gp), with 0 meaning empty dictionary.
 */

import { VM } from './vm';
import {
  NIL,
  Tag,
  toTaggedValue,
  fromTaggedValue,
  isNumber,
  isString,
  isNumber as isNumberTagged,
} from './tagged';
import { isList, getListLength, validateListHeader } from './list';
import { isRef } from './refs';
import { pushListToGlobalHeap, pushSimpleToGlobalHeap } from './global-heap';
import { CELL_SIZE, SEG_DATA, GLOBAL_BASE } from './constants';

// Helper to get byte address from cell index (relative to GLOBAL_BASE_CELLS)
function getByteAddressFromCellIndex(cellIndex: number): number {
  return GLOBAL_BASE + cellIndex * CELL_SIZE;
}

// Unified define: store a fully-formed tagged payload under an interned name
export function define(vm: VM, name: string, payloadTagged: number): void {
  const nameAddr = vm.digest.intern(name);
  const nameTagged = toTaggedValue(nameAddr, Tag.STRING);
  const prevCell = vm.head; // cell index (0 = NIL)
  // Store prevCell as a NUMBER (cell index)
  vm.gpush(prevCell);
  vm.gpush(payloadTagged);
  vm.gpush(nameTagged);
  vm.gpush(toTaggedValue(3, Tag.LIST));
  // head is now the cell index of the header (gp - 1 is relative to GLOBAL_BASE_CELLS)
  vm.head = vm.gp - 1;
  vm.headRef = toTaggedValue(vm.gp - 1, Tag.SENTINEL);

  // console.log(
  //   'define',
  //   name,
  //   'vm.gp',
  //   vm.gp,
  //   'vm.head',
  //   vm.head,
  //   'vm.headRef',
  //   fromTaggedValue(vm.headRef).value,
  // );
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
    if (!isList(hdr) || getListLength(hdr) !== SLOTS) break;

    const base = hAddr - SLOTS * CELL_SIZE;
    const nameCell = vm.memory.readFloat32(SEG_DATA, base + NAME * CELL_SIZE);
    const ni = fromTaggedValue(nameCell);
    if (ni.tag === Tag.STRING && ni.value === target) {
      return vm.memory.readFloat32(SEG_DATA, base + PAYLOAD * CELL_SIZE);
    }

    const prevCellValue = vm.memory.readFloat32(SEG_DATA, base + PREV * CELL_SIZE);
    // prevCell is stored as a NUMBER (cell index)
    cur = isNumber(prevCellValue) ? prevCellValue : 0;
  }

  return NIL;
}

// Dictionary-scope checkpointing (cell-index based)
export function mark(vm: VM): number {
  // Return cell index as a NUMBER (for backward compatibility with forget)
  return vm.gp;
}

export function forget(vm: VM, markCellIndex: number): void {
  // markCellIndex is a NUMBER (cell index relative to GLOBAL_BASE_CELLS)
  const gpNew = markCellIndex;
  if (!Number.isInteger(gpNew) || gpNew < 0) throw new Error('forget mark out of range');
  if (gpNew > vm.gp) throw new Error('forget mark beyond current heap top');
  vm.gp = gpNew;
  // Update head to point to the most recent entry, or 0 if heap is empty
  vm.head = vm.gp === 0 ? 0 : vm.gp - 1;
  vm.headRef = toTaggedValue(vm.head, Tag.SENTINEL);
}

// ============================================================================
// VM Operation Handlers (stack-based interface)
// ============================================================================

// Helper to materialize a value from stack to heap as DATA_REF
function materializeValueRef(vm: VM, value: number): number {
  if (isRef(value)) {
    return value;
  }
  if (isList(value)) {
    validateListHeader(vm);
    const header = vm.peek();
    const n = getListLength(header);
    const baseCell = vm.sp - 1 - n;
    const baseAddrBytes = baseCell * CELL_SIZE;
    const ref = pushListToGlobalHeap(vm, { header, baseAddrBytes });
    // Drop the original list from the data stack
    for (let i = 0; i < n + 1; i++) vm.pop();
    return ref;
  }
  // Simple scalar: copy one cell to heap and consume it from stack
  const ref = pushSimpleToGlobalHeap(vm, value);
  return ref;
}

// Build a LIST entry [prevCell, valueRef, name] on data stack and copy to global heap.
// Returns cell index of the header (relative to GLOBAL_BASE_CELLS)
function pushEntryToHeap(vm: VM, prevCell: number, valueRef: number, name: number): number {
  // Payload order: prevCell (as NUMBER), valueRef, name, then LIST header of length 3
  vm.push(prevCell); // Store as NUMBER (cell index)
  vm.push(valueRef);
  vm.push(name);
  const header = toTaggedValue(3, Tag.LIST);
  vm.push(header);
  const baseCell = vm.sp - 1 - 3;
  const baseAddrBytes = baseCell * CELL_SIZE;
  pushListToGlobalHeap(vm, { header, baseAddrBytes });
  validateListHeader(vm);
  // Remove temporary list from data stack
  for (let i = 0; i < 4; i++) vm.pop();
  // Header is at gp - 1 after push
  return vm.gp - 1;
}

// define: ( value name — )
export function defineOp(vm: VM): void {
  vm.ensureStackSize(2, 'define');
  const name = vm.peek();
  if (!isString(name)) {
    throw new Error('define expects STRING name');
  }
  const value = vm.peekAt(1);

  // Pop name to expose value (especially for LIST path)
  vm.pop();

  let valueRef: number;
  if (isList(value)) {
    valueRef = materializeValueRef(vm, value);
  } else if (isRef(value)) {
    // Remove original value from stack
    vm.pop();
    valueRef = value;
  } else {
    valueRef = pushSimpleToGlobalHeap(vm, value);
    // Remove original value from stack
    vm.pop();
  }

  // Build entry list and update new dictionary head
  const prevCell = vm.head; // cell index (0 = NIL)
  const headerCellIndex = pushEntryToHeap(vm, prevCell, valueRef, name);
  vm.head = headerCellIndex; // Store cell index, not ref
  vm.headRef = toTaggedValue(vm.head, Tag.SENTINEL);
}

// lookup: ( name — ref|NIL )
export function lookupOp(vm: VM): void {
  vm.ensureStackSize(1, 'lookup');
  const name = vm.pop();
  if (!isString(name)) {
    throw new Error('lookup expects STRING name');
  }

  const nameStr = vm.digest.get(fromTaggedValue(name).value);
  const result = lookup(vm, nameStr);
  vm.push(result);
}

// mark: ( — cellIndex )
// Returns cell index (NUMBER) as mark, not a ref
export function markOp(vm: VM): void {
  vm.push(mark(vm)); // Push cell index as NUMBER
}

// forget: ( cellIndex — )
// Accepts cell index (NUMBER) as mark
export function forgetOp(vm: VM): void {
  vm.ensureStackSize(1, 'forget');
  const markCellIndex = vm.pop();
  if (!isNumberTagged(markCellIndex)) {
    throw new Error('forget expects NUMBER (cell index)');
  }
  forget(vm, markCellIndex);
  // headRef is updated inside forget()
}

// Dict-first lookup toggles (no stack effect)
export function dictFirstOnOp(vm: VM): void {
  vm.symbolTable.setDictFirstLookup(true);
}

export function dictFirstOffOp(vm: VM): void {
  vm.symbolTable.setDictFirstLookup(false);
}

// Debug: dump heap-backed dictionary
export function dumpDictOp(vm: VM): void {
  const lines: string[] = [];
  let cur = vm.head; // cell index (0 = NIL)
  let i = 0;
  while (cur !== 0) {
    const hAddr = getByteAddressFromCellIndex(cur);
    const header = vm.memory.readFloat32(SEG_DATA, hAddr);
    if (!isList(header) || getListLength(header) !== 3) break;
    const base = hAddr - 3 * CELL_SIZE;
    const prevCellValue = vm.memory.readFloat32(SEG_DATA, base + 0 * CELL_SIZE);
    const _valueRef = vm.memory.readFloat32(SEG_DATA, base + 1 * CELL_SIZE);
    const entryName = vm.memory.readFloat32(SEG_DATA, base + 2 * CELL_SIZE);
    const nameInfo = fromTaggedValue(entryName);
    const nameStr =
      nameInfo.tag === Tag.STRING ? vm.digest.get(nameInfo.value) : `?tag:${nameInfo.tag}`;
    const prevStr =
      isNumberTagged(prevCellValue) && prevCellValue !== 0 ? `cell@${prevCellValue}` : 'NIL';
    lines.push(`${i}: ${nameStr} -> prev:${prevStr} headerCell:${cur}`);
    cur = isNumberTagged(prevCellValue) ? prevCellValue : 0;
    i++;
  }
  // Print from head to tail
  if (lines.length === 0) console.log('[dict] (empty)');
  else console.log('[dict]\n' + lines.join('\n'));
}
