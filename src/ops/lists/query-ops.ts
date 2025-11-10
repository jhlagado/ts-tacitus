/**
 * @file src/ops/lists/query-ops.ts
 * Read-only and address-returning list operations (segment-aware).
 */

import {
  type VM,
  fromTaggedValue,
  toTaggedValue,
  Tag,
  NIL,
  isNIL,
  dropList,
  pushListToGlobalHeap,
  getListLength,
  isList,
  CELL_SIZE,
  STACK_BASE_BYTES,
  GLOBAL_BASE_BYTES,
  RSTACK_BASE_BYTES,
  isRef,
  createRef,
  getAbsoluteCellIndexFromRef,
  readRefValue,
  areValuesEqual,
  getTag,
} from '@src/core';
import { getListBounds } from './core-helpers';
import { dropOp } from '../stack';
import { isCompatible, updateListInPlace } from '../local-vars-transfer';
import { push, pop, peek, ensureStackSize } from '../../core/vm';
// (no longer using copyCells/cellIndex/cells in absolute migration paths)

/**
 * length: Returns the number of payload slots in a list.
 * Stack: ( list -- count ) or ( x -- NIL )
 * - If input is a list: returns slot count (number of payload elements)
 * - If input is not a list: returns NIL
 */
export function lengthOp(vm: VM): void {
  ensureStackSize(vm, 1, 'length');
  const value = peek(vm);
  const info = getListBounds(vm, value);
  if (!info || !isList(info.header)) {
    dropOp(vm);
    push(vm, NIL);
    return;
  }
  const slotCount = getListLength(info.header);
  dropOp(vm);
  push(vm, slotCount);
}

/**
 * size: Returns the number of logical elements in a list (counting nested lists as single elements).
 * Stack: ( list -- count ) or ( x -- NIL )
 * - If input is a list: returns element count (nested lists count as 1)
 * - If input is not a list: returns NIL
 */
export function sizeOp(vm: VM): void {
  ensureStackSize(vm, 1, 'size');
  const value = peek(vm);
  const info = getListBounds(vm, value);
  if (!info || !isList(info.header)) {
    dropOp(vm);
    push(vm, NIL);
    return;
  }
  const slotCount = getListLength(info.header);
  if (slotCount === 0) {
    dropOp(vm);
    push(vm, 0);
    return;
  }
  // Absolute-only traversal using unified SEG_DATA
  let elementCount = 0;
  let currCell = (info.baseAddrBytes + slotCount * CELL_SIZE - CELL_SIZE) / CELL_SIZE;
  let remainingSlots = slotCount;
  while (remainingSlots > 0) {
    const v = vm.memory.readCell(currCell);
    const span = isList(v) ? getListLength(v) + 1 : 1;
    elementCount++;
    remainingSlots -= span;
    currCell -= span;
  }
  dropOp(vm);
  push(vm, elementCount);
}

/**
 * slot: Returns a REF to the payload slot at the given index.
 * Stack: ( list idx -- ref ) or ( x idx -- NIL )
 * - If input is a list and idx is valid [0, slotCount): returns REF to slot at idx
 * - Otherwise: returns NIL
 */
export function slotOp(vm: VM): void {
  ensureStackSize(vm, 2, 'slot');
  const { value: idx } = fromTaggedValue(pop(vm));
  const target = peek(vm);
  const info = getListBounds(vm, target);
  if (!info || !isList(info.header)) {
    push(vm, NIL);
    return;
  }
  const slotCount = getListLength(info.header);
  if (idx < 0 || idx >= slotCount) {
    push(vm, NIL);
    return;
  }
  // Absolute addressing: compute header absolute byte address and derive element address
  const headerAddr = info.baseAddrBytes + slotCount * CELL_SIZE;
  const addr = headerAddr - (idx + 1) * CELL_SIZE;
  const absCellIndex = addr / CELL_SIZE;
  push(vm, createRef(absCellIndex));
}

/**
 * elem: Returns a REF to the logical element at the given index (counting nested lists as single elements).
 * Stack: ( list idx -- ref ) or ( x idx -- NIL )
 * - If input is a list and idx is valid: returns REF to element at logical index idx
 * - Otherwise: returns NIL
 * - Nested lists count as single elements
 */
export function elemOp(vm: VM): void {
  ensureStackSize(vm, 2, 'elem');
  const { value: idx } = fromTaggedValue(pop(vm));
  const target = peek(vm);
  const info = getListBounds(vm, target);
  if (!info || !isList(info.header)) {
    push(vm, NIL);
    return;
  }
  const slotCount = getListLength(info.header);
  if (idx < 0) {
    push(vm, NIL);
    return;
  }
  // Absolute header address and scan using unified SEG_DATA
  let currentCell = (info.baseAddrBytes + slotCount * CELL_SIZE - CELL_SIZE) / CELL_SIZE;
  let currentLogicalIndex = 0;
  let remainingSlots = slotCount;

  while (remainingSlots > 0 && currentLogicalIndex <= idx) {
    const currentValue = vm.memory.readCell(currentCell);
    let stepSize = 1;
    const elementStartCell = currentCell;

    if (isList(currentValue)) {
      stepSize = getListLength(currentValue) + 1;
    }

    if (currentLogicalIndex === idx) {
      push(vm, createRef(elementStartCell));
      return;
    }

    currentCell -= stepSize;
    remainingSlots -= stepSize;
    currentLogicalIndex++;
  }

  push(vm, NIL);
}

/**
 * fetch: Strict address read (single-level dereference with list materialization).
 * Stack: ( ref -- value... header ) or ( ref -- value )
 * - Reads value at address (single dereference)
 * - If value is a LIST header: materializes payload slots + header to stack
 * - Otherwise: pushes value unchanged
 */
export function fetchOp(vm: VM): void {
  ensureStackSize(vm, 1, 'fetch');
  const addressValue = pop(vm);
  if (!isRef(addressValue)) {
    throw new Error('fetch expects REF address');
  }
  // Absolute dereference
  const addrCell = getAbsoluteCellIndexFromRef(addressValue);
  const value = vm.memory.readCell(addrCell);
  if (isList(value)) {
    const slotCount = getListLength(value);
    for (let i = slotCount - 1; i >= 0; i--) {
      const slotValue = vm.memory.readCell(addrCell - (i + 1));
      push(vm, slotValue);
    }
    push(vm, value);
  } else {
    push(vm, value);
  }
}

/**
 * load: Value-by-default dereference.
 * Stack: ( x -- v )
 * - If x is not a reference: push x unchanged (identity)
 * - If x is a reference: read once; if the read value is a reference, dereference one more level;
 *   if the final value is a LIST header, materialize payload+header; else push the simple value.
 */
export function loadOp(vm: VM): void {
  ensureStackSize(vm, 1, 'load');
  const input = pop(vm);

  // Identity on non-refs
  if (!isRef(input)) {
    push(vm, input);
    return;
  }

  // Absolute first dereference
  let addr2Cell = getAbsoluteCellIndexFromRef(input);
  let value = vm.memory.readCell(addr2Cell);

  // Optional second dereference if the loaded value is itself a reference
  if (isRef(value)) {
    addr2Cell = getAbsoluteCellIndexFromRef(value);
    value = vm.memory.readCell(addr2Cell);
  }

  // Materialize if final value is a LIST header
  // Debug: check if value is actually a list
  if (isList(value)) {
    const slotCount = getListLength(value);
    // Read payload slots (they are stored before the header)
    // Use same formula as fetchOp: addr2Cell - (i + 1)
    for (let i = slotCount - 1; i >= 0; i--) {
      const payloadCellIndex = addr2Cell - (i + 1);
      const slotValue = vm.memory.readCell(payloadCellIndex);
      push(vm, slotValue);
    }
    push(vm, value); // Push header last (TOS)
    return;
  }

  // If we get here, value is not a list - just push it
  push(vm, value);
}

type SlotAddress = { segment: number; address: number };

type SlotInfo = {
  root: SlotAddress;
  rootValue: number;
  resolved: SlotAddress;
  existingValue: number;
  rootAbsAddr: number;
  resolvedAbsAddr: number;
};

function resolveSlot(vm: VM, addressValue: number): SlotInfo {
  // Absolute-only resolution of slot location and (optional) one-level indirection
  const rootAbsCell = getAbsoluteCellIndexFromRef(addressValue);
  const rootValue = vm.memory.readCell(rootAbsCell);

  // Classify absolute address to legacy segment/address pair for compatibility
  const classify = (absCell: number): SlotAddress => {
    const absAddr = absCell * CELL_SIZE;
    if (absAddr >= GLOBAL_BASE_BYTES && absAddr < STACK_BASE_BYTES) {
      return { segment: 2, address: absAddr - GLOBAL_BASE_BYTES };
    }
    if (absAddr >= STACK_BASE_BYTES && absAddr < RSTACK_BASE_BYTES) {
      return { segment: 0, address: absAddr - STACK_BASE_BYTES };
    }
    return { segment: 1, address: absAddr - RSTACK_BASE_BYTES };
  };

  let resolvedAbsCell = rootAbsCell;
  let existingValue = rootValue;
  if (isRef(rootValue)) {
    resolvedAbsCell = getAbsoluteCellIndexFromRef(rootValue);
    existingValue = vm.memory.readCell(resolvedAbsCell);
  }

  const root = classify(rootAbsCell);
  const resolved = classify(resolvedAbsCell);
  return {
    root,
    rootValue,
    resolved,
    existingValue,
    rootAbsAddr: rootAbsCell * CELL_SIZE,
    resolvedAbsAddr: resolvedAbsCell * CELL_SIZE,
  };
}

function discardCompoundSource(vm: VM, rhsTag: Tag): void {
  if (rhsTag === Tag.LIST) {
    dropList(vm);
    return;
  }
  pop(vm);
}

function initializeGlobalCompound(
  vm: VM,
  slot: SlotInfo,
  rhsInfo: { header: number; baseAddrBytes: number },
  rhsTag: Tag,
): void {
  // Absolute-only global allocation of compound
  const heapRef = pushListToGlobalHeap(vm, rhsInfo);
  // Write directly via absolute address
  vm.memory.writeCell(slot.rootAbsAddr / CELL_SIZE, heapRef);
  discardCompoundSource(vm, rhsTag);
}

function copyCompoundFromReference(
  vm: VM,
  rhsInfo: { header: number; baseAddrBytes: number },
  targetAbsHeaderAddr: number,
  slotCount: number,
): void {
  // Absolute-only copy using unified data segment
  const srcBaseCell = rhsInfo.baseAddrBytes / CELL_SIZE;
  const targetHeaderCell = targetAbsHeaderAddr / CELL_SIZE;
  const targetBaseCell = targetHeaderCell - slotCount;

  for (let i = 0; i < slotCount; i++) {
    const v = vm.memory.readCell(srcBaseCell + i);
    vm.memory.writeCell(targetBaseCell + i, v);
  }
  vm.memory.writeCell(targetHeaderCell, rhsInfo.header);
}

function tryStoreCompound(vm: VM, slot: SlotInfo, rhsValue: number): boolean {
  const rhsInfoAbs = getListBounds(vm, rhsValue);
  if (!rhsInfoAbs || !isList(rhsInfoAbs.header)) {
    return false;
  }

  const rhsTag = getTag(rhsValue);
  const slotCount = getListLength(rhsInfoAbs.header);
  // Treat NIL (0) or uninitialized as non-compound for new globals
  const existingIsCompound = !isNIL(slot.existingValue) && isList(slot.existingValue);

  if (!existingIsCompound) {
    // Prefer absolute address window over legacy segment label
    if (slot.rootAbsAddr >= GLOBAL_BASE_BYTES && slot.rootAbsAddr < STACK_BASE_BYTES) {
      initializeGlobalCompound(vm, slot, rhsInfoAbs, rhsTag);
      return true;
    }
    discardCompoundSource(vm, rhsTag);
    throw new Error('Cannot assign simple to compound or compound to simple');
  }

  if (!isCompatible(slot.existingValue, rhsInfoAbs.header)) {
    discardCompoundSource(vm, rhsTag);
    throw new Error('Incompatible compound assignment: slot count or type mismatch');
  }

  if (rhsTag === Tag.LIST) {
    // Absolute in-place update
    updateListInPlace(vm, slot.resolvedAbsAddr);
    return true;
  }

  // Absolute copy into resolved header location
  copyCompoundFromReference(vm, rhsInfoAbs, slot.resolvedAbsAddr, slotCount);
  pop(vm);
  return true;
}

function storeSimpleValue(vm: VM, slot: SlotInfo, rhsValue: number): void {
  let value = rhsValue;
  if (isRef(value)) {
    value = readRefValue(vm, value);
    pop(vm);
    push(vm, value);
  }

  const valueIsCompound = isList(value);
  // Treat NIL (0) or uninitialized as non-compound for new globals
  const existingIsCompound = !isNIL(slot.existingValue) && isList(slot.existingValue);
  if (!valueIsCompound && !existingIsCompound) {
    pop(vm);
    vm.memory.writeCell(slot.rootAbsAddr / CELL_SIZE, value);
    return;
  }

  pop(vm);
  throw new Error('Cannot assign simple to compound or compound to simple');
}

/**
 * store: Writes value to memory address (designed for local variables).
 * Stack: ( value ref -- )
 * - Pops address (REF) and value
 * - Writes value to address (handles compounds by copying to appropriate area)
 * - For compounds: copies to heap/stack area and stores REF
 * - For simple values: writes directly
 * - Note: Designed for local variables; uses resolveSlot which assumes local semantics
 */
export function storeOp(vm: VM): void {
  ensureStackSize(vm, 2, 'store');
  const addressValue = pop(vm);
  const rhsTop = peek(vm);

  if (!isRef(addressValue)) {
    throw new Error('store expects REF address');
  }

  const slot = resolveSlot(vm, addressValue);

  if (tryStoreCompound(vm, slot, rhsTop)) {
    return;
  }

  storeSimpleValue(vm, slot, rhsTop);
}

/**
 * walk: Iterates payload cells of a LIST by relative slot index.
 * Stack: ( ref idx -- ref idx' val )
 * - `ref` must reference a LIST header (segment-aware). It is left on stack.
 * - `idx` is 0-based relative offset into payload slots.
 * - If idx < slots:
 *    - Reads the cell at position idx (from element 0 upward).
 *    - Returns simple values directly; returns a reference for LIST cells (no materialization).
 *    - `idx' = idx + 1`.
 * - If idx >= slots:
 *    - Returns `NIL` and resets `idx' = 0` for convenient looping.
 */
export function walkOp(vm: VM): void {
  ensureStackSize(vm, 2, 'walk');
  const { value: idx } = fromTaggedValue(pop(vm));
  const target = peek(vm);
  const info = getListBounds(vm, target);
  if (!info || !isList(info.header)) {
    // Leave target, push idx (reset) and NIL
    push(vm, 0);
    push(vm, NIL);
    return;
  }
  const slotCount = getListLength(info.header);
  if (idx >= slotCount || idx < 0) {
    push(vm, 0);
    push(vm, NIL);
    return;
  }
  // Absolute addressing via unified data segment
  const headerAbsAddr = info.baseAddrBytes + slotCount * CELL_SIZE;
  const cellAbsAddr = headerAbsAddr - (idx + 1) * CELL_SIZE;
  const v = vm.memory.readCell(cellAbsAddr / CELL_SIZE);
  const nextIdx = idx + 1;
  push(vm, nextIdx);
  if (isList(v)) {
    const absCellIndex = cellAbsAddr / CELL_SIZE;
    push(vm, createRef(absCellIndex));
  } else {
    push(vm, v);
  }
}

/**
 * find: Finds a key-value pair in a maplist and returns REF to the value.
 * Stack: ( list key -- ref ) or ( x key -- NIL )
 * - If input is a maplist (even slot count) and key is found: returns REF to value
 * - If key not found but 'default' key exists: returns REF to default value
 * - Otherwise: returns NIL
 */
export function findOp(vm: VM): void {
  ensureStackSize(vm, 2, 'find');
  const key = pop(vm);
  const target = peek(vm);
  const info = getListBounds(vm, target);
  if (!info || !isList(info.header)) {
    push(vm, NIL);
    return;
  }
  const slotCount = getListLength(info.header);
  if (slotCount % 2 !== 0 || slotCount === 0) {
    push(vm, NIL);
    return;
  }
  const headerAbsAddr = info.baseAddrBytes + slotCount * CELL_SIZE;
  let defaultValueAddr = -1;
  for (let i = 0; i < slotCount; i += 2) {
    const keyAbsAddr = headerAbsAddr - CELL_SIZE - i * CELL_SIZE;
    const valueAbsAddr = headerAbsAddr - CELL_SIZE - (i + 1) * CELL_SIZE;
    const currentKey = vm.memory.readCell(keyAbsAddr / CELL_SIZE);
    if (areValuesEqual(currentKey, key)) {
      const absCellIndex = valueAbsAddr / CELL_SIZE;
      push(vm, createRef(absCellIndex));
      return;
    }
    const { tag: keyTag, value: keyValue } = fromTaggedValue(currentKey);
    if (keyTag === Tag.STRING) {
      const keyStr = vm.digest.get(keyValue);
      if (keyStr === 'default') {
        defaultValueAddr = valueAbsAddr;
      }
    }
  }
  if (defaultValueAddr !== -1) {
    const absCellIndex = defaultValueAddr / CELL_SIZE;
    push(vm, createRef(absCellIndex));
    return;
  }
  push(vm, NIL);
}

/**
 * keys: Extracts all keys from a maplist.
 * Stack: ( maplist -- keys_list ) or ( x -- NIL )
 * - If input is a maplist (even slot count): returns list of keys
 * - If input is empty maplist: returns empty list
 * - Otherwise: returns NIL
 */
export function keysOp(vm: VM): void {
  ensureStackSize(vm, 1, 'keys');
  const target = peek(vm);
  const info = getListBounds(vm, target);
  if (!info || !isList(info.header)) {
    pop(vm);
    push(vm, NIL);
    return;
  }
  const slotCount = getListLength(info.header);
  if (slotCount % 2 !== 0) {
    pop(vm);
    push(vm, NIL);
    return;
  }
  pop(vm);
  push(vm, info.header);
  if (slotCount === 0) {
    push(vm, toTaggedValue(0, Tag.LIST));
    return;
  }
  const keyCount = slotCount / 2;
  const headerAbsAddr = info.baseAddrBytes + slotCount * CELL_SIZE;
  for (let i = keyCount - 1; i >= 0; i--) {
    const keyAbsAddr = headerAbsAddr - CELL_SIZE - i * 2 * CELL_SIZE;
    const keyValue = vm.memory.readCell(keyAbsAddr / CELL_SIZE);
    push(vm, keyValue);
  }
  push(vm, toTaggedValue(keyCount, Tag.LIST));
}

/**
 * values: Extracts all values from a maplist.
 * Stack: ( maplist -- values_list ) or ( x -- NIL )
 * - If input is a maplist (even slot count): returns list of values
 * - If input is empty maplist: returns empty list
 * - Otherwise: returns NIL
 */
export function valuesOp(vm: VM): void {
  ensureStackSize(vm, 1, 'values');
  const target = peek(vm);
  const info = getListBounds(vm, target);
  if (!info || !isList(info.header)) {
    pop(vm);
    push(vm, NIL);
    return;
  }
  const slotCount = getListLength(info.header);
  if (slotCount % 2 !== 0) {
    pop(vm);
    push(vm, NIL);
    return;
  }
  pop(vm);
  push(vm, info.header);
  if (slotCount === 0) {
    push(vm, toTaggedValue(0, Tag.LIST));
    return;
  }
  const valueCount = slotCount / 2;
  const headerAbsAddr = info.baseAddrBytes + slotCount * CELL_SIZE;
  for (let i = valueCount - 1; i >= 0; i--) {
    const valueAbsAddr = headerAbsAddr - CELL_SIZE - (i * 2 + 1) * CELL_SIZE;
    const valueValue = vm.memory.readCell(valueAbsAddr / CELL_SIZE);
    push(vm, valueValue);
  }
  push(vm, toTaggedValue(valueCount, Tag.LIST));
}

/**
 * ref: Creates a REF to the list header on top of stack.
 * Stack: ( list -- ref ) or ( x -- x )
 * - If input is a LIST header: replaces it with REF to header cell
 * - Otherwise: leaves value unchanged (identity)
 */
export function refOp(vm: VM): void {
  ensureStackSize(vm, 1, 'ref');
  const value = peek(vm);
  const tag = getTag(value);
  if (tag === Tag.LIST) {
    // sp is an absolute cell index; build absolute REF
    const headerCellIndex = vm.sp - 1;
    push(vm, createRef(headerCellIndex));
  }
}

// resolveOp removed; use loadOp instead
