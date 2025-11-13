/**
 * @file src/ops/lists/query-ops.ts
 * Read-only and address-returning list operations (segment-aware).
 */

import {
  type VM,
  getTaggedInfo,
  Tagged,
  Tag,
  NIL,
  isNIL,
  dropList,
  gpushList,
  getListLength,
  isList,
  CELL_SIZE,
  STACK_BASE_BYTES,
  GLOBAL_BASE_BYTES,
  RSTACK_BASE_BYTES,
  isRef,
  createRef,
  getCellFromRef,
  readRef,
  areValuesEqual,
  getRefArea,
  copyListPayload,
} from '@src/core';
import { getListBounds } from './core-helpers';
import { dropOp } from '../stack';
import { isCompatible, updateList } from '../local-vars-transfer';
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
  let elementCount = 0;
  let currCell = info.headerCell - 1;
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
  const { value: idx } = getTaggedInfo(pop(vm));
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
  const hdr = info.headerCell;
  const cell = hdr - (idx + 1);
  push(vm, createRef(cell));
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
  const { value: idx } = getTaggedInfo(pop(vm));
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
  let currentCell = info.headerCell - 1;
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
  // Dereference
  const addrCell = getCellFromRef(addressValue);
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

  // First dereference
  let addr2Cell = getCellFromRef(input);
  let value = vm.memory.readCell(addr2Cell);

  // Optional second dereference if the loaded value is itself a reference
  if (isRef(value)) {
    addr2Cell = getCellFromRef(value);
    value = vm.memory.readCell(addr2Cell);
  }

  // Materialize if final value is a LIST header
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
  rootCell: number;
  resolvedCell: number;
};

/**
 * Resolves a slot address to its location and current value.
 * Handles one level of indirection if the slot contains a REF.
 * @param vm - VM instance
 * @param addressValue - REF to the slot
 * @returns Slot information including root and resolved addresses
 */
function resolveSlot(vm: VM, addressValue: number): SlotInfo {
  // Resolution of slot location and (optional) one-level indirection
  const rootAbsCell = getCellFromRef(addressValue);
  const rootValue = vm.memory.readCell(rootAbsCell);

  // Classify absolute address to legacy segment/address pair for compatibility
  const classify = (cell: number): SlotAddress => {
    const addr = cell * CELL_SIZE;
    if (addr >= GLOBAL_BASE_BYTES && addr < STACK_BASE_BYTES) {
      return { segment: 2, address: addr - GLOBAL_BASE_BYTES };
    }
    if (addr >= STACK_BASE_BYTES && addr < RSTACK_BASE_BYTES) {
      return { segment: 0, address: addr - STACK_BASE_BYTES };
    }
    return { segment: 1, address: addr - RSTACK_BASE_BYTES };
  };

  let resolvedCell = rootAbsCell;
  let existingValue = rootValue;
  if (isRef(rootValue)) {
    resolvedCell = getCellFromRef(rootValue);
    existingValue = vm.memory.readCell(resolvedCell);
  }

  const root = classify(rootAbsCell);
  const resolved = classify(resolvedCell);
  return {
    root,
    rootValue,
    resolved,
    existingValue,
    rootCell: rootAbsCell,
    resolvedCell,
  };
}

/**
 * Discards compound source from stack after failed assignment.
 * @param vm - VM instance
 * @param rhsTag - Tag of the right-hand side value
 */
function discardCompoundSource(vm: VM, rhsTag: Tag): void {
  if (rhsTag === Tag.LIST) {
    dropList(vm);
    return;
  }
  pop(vm);
}

/**
 * Initializes a new compound value in a global variable slot.
 * Copies the list from data stack to global heap.
 * @param vm - VM instance
 * @param cell - Cell index of the global slot
 */
function initializeGlobalCompound(vm: VM, cell: number): void {
  const heapRef = gpushList(vm);
  vm.memory.writeCell(cell, heapRef);
}

/**
 * Copies a compound value from a reference location to a target location.
 * @param vm - VM instance
 * @param rhsInfo - Source list information (header and base address)
 * @param targetHeaderCell - Target header cell index
 * @param slotCount - Number of payload slots to copy
 */
function copyFromRef(
  vm: VM,
  rhsInfo: { header: number; baseCell: number },
  targetHeaderCell: number,
  slotCount: number,
): void {
  const targetBaseCell = targetHeaderCell - slotCount;
  copyListPayload(vm, rhsInfo.baseCell, targetBaseCell, slotCount);
  vm.memory.writeCell(targetHeaderCell, rhsInfo.header);
}

/**
 * Tries to store a compound value to a local variable slot.
 * Used by storeLocal for local variable compound assignment.
 * Returns true if compound was stored, false if not a compound.
 */
function tryStoreCompound(vm: VM, slot: SlotInfo, rhsValue: number): boolean {
  const rhsInfo = getListBounds(vm, rhsValue);
  if (!rhsInfo || !isList(rhsInfo.header)) {
    return false;
  }

  const { tag: rhsTag } = getTaggedInfo(rhsValue);
  const slotCount = getListLength(rhsInfo.header);
  const existingIsCompound = !isNIL(slot.existingValue) && isList(slot.existingValue);

  if (!existingIsCompound) {
    // New compound for local: use existing local variable logic
    discardCompoundSource(vm, rhsTag);
    throw new Error('Cannot assign simple to compound or compound to simple');
  }

  if (!isCompatible(slot.existingValue, rhsInfo.header)) {
    discardCompoundSource(vm, rhsTag);
    throw new Error('Incompatible compound assignment: slot count or type mismatch');
  }

  if (rhsTag === Tag.LIST) {
    // In-place update for locals
    updateList(vm, slot.resolvedCell);
    return true;
  }

  // Copy into resolved header location
  copyFromRef(vm, rhsInfo, slot.resolvedCell, slotCount);
  pop(vm);
  return true;
}

/**
 * Stores a value to a global variable.
 * Handles simple values and compounds (new and compatible updates).
 * Materializes REFs before assignment (per spec section 6.3).
 * @param vm - VM instance
 * @param cell - Cell index of the global slot
 * @param rhsValue - Value to store (may be a REF)
 */
function storeGlobal(vm: VM, cell: number, rhsValue: number): void {
  if (isRef(rhsValue)) {
    // Pop the REF and materialize using loadOp logic
    pop(vm);
    const addrCell = getCellFromRef(rhsValue);
    let value = vm.memory.readCell(addrCell);

    // Optional second dereference if the loaded value is itself a reference
    if (isRef(value)) {
      const addr2Cell = getCellFromRef(value);
      value = vm.memory.readCell(addr2Cell);

      // If it's a list, materialize it
      if (isList(value)) {
        const slotCount = getListLength(value);
        for (let i = slotCount - 1; i >= 0; i--) {
          const payloadCellIndex = addr2Cell - (i + 1);
          const slotValue = vm.memory.readCell(payloadCellIndex);
          push(vm, slotValue);
        }
        push(vm, value);
        // Now value on stack is the list, continue below
      } else {
        push(vm, value);
      }
    } else if (isList(value)) {
      // Materialize list from first dereference
      const slotCount = getListLength(value);
      for (let i = slotCount - 1; i >= 0; i--) {
        const payloadCellIndex = addrCell - (i + 1);
        const slotValue = vm.memory.readCell(payloadCellIndex);
        push(vm, slotValue);
      }
      push(vm, value);
    } else {
      push(vm, value);
    }
  }

  const existingValue = vm.memory.readCell(cell);
  const valueIsCompound = isList(peek(vm));
  const existingIsCompound = !isNIL(existingValue) && isList(existingValue);

  // Simple value assignment
  if (!valueIsCompound && !existingIsCompound) {
    const simpleValue = pop(vm);
    vm.memory.writeCell(cell, simpleValue);
    return;
  }

  // Compound assignment
  if (valueIsCompound) {
    if (!existingIsCompound) {
      // New compound: allocate in global heap
      initializeGlobalCompound(vm, cell);
      return;
    }

    // Compatible compound: in-place update (per spec section 6.3)
    const currentHeader = peek(vm);
    if (!isCompatible(existingValue, currentHeader)) {
      dropList(vm);
      throw new Error('Incompatible compound assignment: slot count or type mismatch');
    }

    // In-place update (more efficient than copying)
    const existingRef = existingValue;
    if (!isRef(existingRef)) {
      dropList(vm);
      throw new Error('Expected REF in global cell for compound');
    }
    const existingHeaderCell = getCellFromRef(existingRef);
    updateList(vm, existingHeaderCell);
    return;
  }

  // Error: simple to compound or compound to simple
  pop(vm);
  throw new Error('Cannot assign simple to compound or compound to simple');
}

/**
 * Stores a value to a local variable (return stack area).
 * Uses existing local variable logic via resolveSlot.
 * @param vm - VM instance
 * @param addressValue - REF to the local variable slot
 * @param rhsValue - Value to store
 */
function storeLocal(vm: VM, addressValue: number, rhsValue: number): void {
  const slot = resolveSlot(vm, addressValue);

  if (tryStoreCompound(vm, slot, rhsValue)) {
    return;
  }

  storeSimpleValue(vm, slot, rhsValue);
}

/**
 * Stores a simple (non-compound) value to a slot.
 * @param vm - VM instance
 * @param slot - Slot information from resolveSlot
 * @param rhsValue - Simple value to store
 * @throws {Error} If attempting to assign compound to simple or vice versa
 */
function storeSimpleValue(vm: VM, slot: SlotInfo, rhsValue: number): void {
  let value = rhsValue;
  if (isRef(value)) {
    value = readRef(vm, value);
    pop(vm);
    push(vm, value);
  }

  const valueIsCompound = isList(value);
  // Treat NIL (0) or uninitialized as non-compound for new globals
  const existingIsCompound = !isNIL(slot.existingValue) && isList(slot.existingValue);
  if (!valueIsCompound && !existingIsCompound) {
    pop(vm);
    vm.memory.writeCell(slot.rootCell, value);
    return;
  }

  pop(vm);
  throw new Error('Cannot assign simple to compound or compound to simple');
}

/**
 * store: Writes value to memory address (works for both locals and globals).
 * Stack: ( value ref -- )
 * - Pops address (REF) and value
 * - Detects area at runtime (global vs local/rstack)
 * - Dispatches to appropriate helper: storeGlobal or storeLocal
 */
export function storeOp(vm: VM): void {
  ensureStackSize(vm, 2, 'store');
  const addressValue = pop(vm);
  const rhsTop = peek(vm);

  if (!isRef(addressValue)) {
    throw new Error('store expects REF address');
  }

  // Detect area at runtime
  const area = getRefArea(addressValue);
  const cell = getCellFromRef(addressValue);

  if (area === 'global') {
    storeGlobal(vm, cell, rhsTop);
  } else if (area === 'stack') {
    // Data stack: Store can write anywhere in the data segment
    // Variable addresses are restricted at compile-time (InitVar/InitGlobal only target rstack/global)
    // Store to stack is allowed for list element mutation and other legitimate uses
    // Use resolveSlot to handle potential indirection, then storeLocal logic
    const slot = resolveSlot(vm, addressValue);
    if (tryStoreCompound(vm, slot, rhsTop)) {
      return;
    }
    storeSimpleValue(vm, slot, rhsTop);
  } else {
    // rstack (locals): use existing local variable logic
    storeLocal(vm, addressValue, rhsTop);
  }
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
  const { value: idx } = getTaggedInfo(pop(vm));
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
  const hdr = info.headerCell;
  const cell = hdr - (idx + 1);
  const v = vm.memory.readCell(cell);
  const nextIdx = idx + 1;
  push(vm, nextIdx);
  if (isList(v)) {
    push(vm, createRef(cell));
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
  const hdr = info.headerCell;
  let defaultCell = -1;
  for (let i = 0; i < slotCount; i += 2) {
    const keyCell = hdr - 1 - i;
    const valCell = hdr - 1 - (i + 1);
    const currentKey = vm.memory.readCell(keyCell);
    if (areValuesEqual(currentKey, key)) {
      push(vm, createRef(valCell));
      return;
    }
    const { tag: keyTag, value: keyValue } = getTaggedInfo(currentKey);
    if (keyTag === Tag.STRING) {
      const keyStr = vm.digest.get(keyValue);
      if (keyStr === 'default') {
        defaultCell = valCell;
      }
    }
  }
  if (defaultCell !== -1) {
    push(vm, createRef(defaultCell));
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
    push(vm, Tagged(0, Tag.LIST));
    return;
  }
  const keyCount = slotCount / 2;
  const hdr = info.headerCell;
  for (let i = keyCount - 1; i >= 0; i--) {
    const keyCell = hdr - 1 - i * 2;
    const keyValue = vm.memory.readCell(keyCell);
    push(vm, keyValue);
  }
  push(vm, Tagged(keyCount, Tag.LIST));
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
    push(vm, Tagged(0, Tag.LIST));
    return;
  }
  const valueCount = slotCount / 2;
  const hdr = info.headerCell;
  for (let i = valueCount - 1; i >= 0; i--) {
    const valCell = hdr - 1 - (i * 2 + 1);
    const valueValue = vm.memory.readCell(valCell);
    push(vm, valueValue);
  }
  push(vm, Tagged(valueCount, Tag.LIST));
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
  const { tag } = getTaggedInfo(value);
  if (tag === Tag.LIST) {
    // sp is an absolute cell index; build absolute REF
    const headerCellIndex = vm.sp - 1;
    push(vm, createRef(headerCellIndex));
  }
}

// resolveOp removed; use loadOp instead
