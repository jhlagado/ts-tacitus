/**
 * @file src/ops/lists/query-ops.ts
 * Read-only and address-returning list operations (segment-aware).
 */

import {
  VM,
  fromTaggedValue,
  toTaggedValue,
  Tag,
  NIL,
  dropList,
  pushListToGlobalHeap,
} from '@src/core';
import { getListLength, isList } from '@src/core';
import {
  CELL_SIZE,
  SEG_GLOBAL,
  SEG_RSTACK,
  SEG_STACK,
  SEG_DATA,
  STACK_BASE,
  GLOBAL_BASE,
  RSTACK_BASE,
} from '@src/core';
import { getListBounds } from './core-helpers';
import { isRef, createDataRefAbs, getAbsoluteByteAddressFromRef, readRefValueAbs } from '@src/core';
import { dropOp } from '../stack';
import { isCompatible, updateListInPlaceAbs } from '../local-vars-transfer';
import { areValuesEqual, getTag } from '@src/core';
// (no longer using copyCells/cellIndex/cells in absolute migration paths)

export function lengthOp(vm: VM): void {
  vm.ensureStackSize(1, 'length');
  const value = vm.peek();
  const info = getListBounds(vm, value);
  if (!info || !isList(info.header)) {
    dropOp(vm);
    vm.push(NIL);
    return;
  }
  const slotCount = getListLength(info.header);
  dropOp(vm);
  vm.push(slotCount);
}

export function sizeOp(vm: VM): void {
  vm.ensureStackSize(1, 'size');
  const value = vm.peek();
  const info = getListBounds(vm, value);
  if (!info || !isList(info.header)) {
    dropOp(vm);
    vm.push(NIL);
    return;
  }
  const slotCount = getListLength(info.header);
  if (slotCount === 0) {
    dropOp(vm);
    vm.push(0);
    return;
  }
  // Absolute-only traversal using unified SEG_DATA
  let elementCount = 0;
  let currentAbsAddr = info.absBaseAddrBytes + slotCount * CELL_SIZE - CELL_SIZE;
  let remainingSlots = slotCount;
  while (remainingSlots > 0) {
    const v = vm.memory.readFloat32(SEG_DATA, currentAbsAddr);
    const span = isList(v) ? getListLength(v) + 1 : 1;
    elementCount++;
    remainingSlots -= span;
    currentAbsAddr -= span * CELL_SIZE;
  }
  dropOp(vm);
  vm.push(elementCount);
}

export function slotOp(vm: VM): void {
  vm.ensureStackSize(2, 'slot');
  const { value: idx } = fromTaggedValue(vm.pop());
  const target = vm.peek();
  const info = getListBounds(vm, target);
  if (!info || !isList(info.header)) {
    vm.push(NIL);
    return;
  }
  const slotCount = getListLength(info.header);
  if (idx < 0 || idx >= slotCount) {
    vm.push(NIL);
    return;
  }
  // Absolute addressing: compute header absolute byte address and derive element address
  const headerAbsAddr = info.absBaseAddrBytes + slotCount * CELL_SIZE;
  const addr = headerAbsAddr - (idx + 1) * CELL_SIZE;
  const absCellIndex = addr / CELL_SIZE;
  vm.push(createDataRefAbs(absCellIndex));
}

export function elemOp(vm: VM): void {
  vm.ensureStackSize(2, 'elem');
  const { value: idx } = fromTaggedValue(vm.pop());
  const target = vm.peek();
  const info = getListBounds(vm, target);
  if (!info || !isList(info.header)) {
    vm.push(NIL);
    return;
  }
  const slotCount = getListLength(info.header);
  if (idx < 0) {
    vm.push(NIL);
    return;
  }
  // Absolute header address and scan using unified SEG_DATA
  let currentAddr = info.absBaseAddrBytes + slotCount * CELL_SIZE - CELL_SIZE;
  let currentLogicalIndex = 0;
  let remainingSlots = slotCount;

  while (remainingSlots > 0 && currentLogicalIndex <= idx) {
    const currentValue = vm.memory.readFloat32(SEG_DATA, currentAddr);
    let stepSize = 1;
    let elementStartAddr = currentAddr;

    if (isList(currentValue)) {
      stepSize = getListLength(currentValue) + 1;
    }

    if (currentLogicalIndex === idx) {
      const absCellIndex = elementStartAddr / CELL_SIZE;
      vm.push(createDataRefAbs(absCellIndex));
      return;
    }

    currentAddr -= stepSize * CELL_SIZE;
    remainingSlots -= stepSize;
    currentLogicalIndex++;
  }

  vm.push(NIL);
}

export function fetchOp(vm: VM): void {
  vm.ensureStackSize(1, 'fetch');
  const addressValue = vm.pop();
  if (!isRef(addressValue)) {
    throw new Error('fetch expects DATA_REF address');
  }
  // Absolute dereference
  const absAddr = getAbsoluteByteAddressFromRef(addressValue);
  const value = vm.memory.readFloat32(SEG_DATA, absAddr);
  if (isList(value)) {
    const slotCount = getListLength(value);
    for (let i = slotCount - 1; i >= 0; i--) {
      const slotValue = vm.memory.readFloat32(SEG_DATA, absAddr - (i + 1) * CELL_SIZE);
      vm.push(slotValue);
    }
    vm.push(value);
  } else {
    vm.push(value);
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
  vm.ensureStackSize(1, 'load');
  const input = vm.pop();

  // Identity on non-refs
  if (!isRef(input)) {
    vm.push(input);
    return;
  }

  // Absolute first dereference
  let absAddr = getAbsoluteByteAddressFromRef(input);
  let value = vm.memory.readFloat32(SEG_DATA, absAddr);

  // Optional second dereference if the loaded value is itself a reference
  if (isRef(value)) {
    absAddr = getAbsoluteByteAddressFromRef(value);
    value = vm.memory.readFloat32(SEG_DATA, absAddr);
  }

  // Materialize if final value is a LIST header
  if (isList(value)) {
    const slotCount = getListLength(value);
    for (let i = slotCount - 1; i >= 0; i--) {
      const slotValue = vm.memory.readFloat32(SEG_DATA, absAddr - (i + 1) * CELL_SIZE);
      vm.push(slotValue);
    }
    vm.push(value);
    return;
  }

  vm.push(value);
}

type SlotAddress = { segment: number; address: number };

interface SlotInfo {
  root: SlotAddress;
  rootValue: number;
  resolved: SlotAddress;
  existingValue: number;
  rootAbsAddr: number;
  resolvedAbsAddr: number;
}

function resolveSlot(vm: VM, addressValue: number): SlotInfo {
  // Absolute-only resolution of slot location and (optional) one-level indirection
  const rootAbsAddr = getAbsoluteByteAddressFromRef(addressValue);
  const rootValue = vm.memory.readFloat32(SEG_DATA, rootAbsAddr);

  // Classify absolute address to legacy segment/address pair for compatibility
  const classify = (absAddr: number): SlotAddress => {
    if (absAddr >= GLOBAL_BASE && absAddr < STACK_BASE) {
      return { segment: SEG_GLOBAL, address: absAddr - GLOBAL_BASE };
    }
    if (absAddr >= STACK_BASE && absAddr < RSTACK_BASE) {
      return { segment: SEG_STACK, address: absAddr - STACK_BASE };
    }
    return { segment: SEG_RSTACK, address: absAddr - RSTACK_BASE };
  };

  let resolvedAbsAddr = rootAbsAddr;
  let existingValue = rootValue;
  if (isRef(rootValue)) {
    resolvedAbsAddr = getAbsoluteByteAddressFromRef(rootValue);
    existingValue = vm.memory.readFloat32(SEG_DATA, resolvedAbsAddr);
  }

  const root = classify(rootAbsAddr);
  const resolved = classify(resolvedAbsAddr);
  return { root, rootValue, resolved, existingValue, rootAbsAddr, resolvedAbsAddr };
}

function discardCompoundSource(vm: VM, rhsTag: Tag): void {
  if (rhsTag === Tag.LIST) {
    dropList(vm);
    return;
  }
  vm.pop();
}

function initializeGlobalCompound(
  vm: VM,
  slot: SlotInfo,
  rhsInfo: { header: number; baseAddr: number; segment: number },
  rhsTag: Tag,
): void {
  const heapRef = pushListToGlobalHeap(vm, rhsInfo);
  // Write directly via absolute address
  vm.memory.writeFloat32(SEG_DATA, slot.rootAbsAddr, heapRef);
  discardCompoundSource(vm, rhsTag);
}

function copyCompoundFromReference(
  vm: VM,
  rhsInfo: { header: number; baseAddr: number; segment: number; absBaseAddrBytes?: number },
  targetAbsHeaderAddr: number,
  slotCount: number,
): void {
  // Absolute-only copy using unified data segment
  const srcBaseAbs =
    rhsInfo.absBaseAddrBytes !== undefined
      ? rhsInfo.absBaseAddrBytes
      : (rhsInfo.segment === SEG_GLOBAL
          ? GLOBAL_BASE
          : rhsInfo.segment === SEG_RSTACK
            ? RSTACK_BASE
            : STACK_BASE) + rhsInfo.baseAddr;
  const targetBaseAbs = targetAbsHeaderAddr - slotCount * CELL_SIZE;

  for (let i = 0; i < slotCount; i++) {
    const v = vm.memory.readFloat32(SEG_DATA, srcBaseAbs + i * CELL_SIZE);
    vm.memory.writeFloat32(SEG_DATA, targetBaseAbs + i * CELL_SIZE, v);
  }
  const targetHeaderAbs = targetBaseAbs + slotCount * CELL_SIZE;
  vm.memory.writeFloat32(SEG_DATA, targetHeaderAbs, rhsInfo.header);
}

function tryStoreCompound(vm: VM, slot: SlotInfo, rhsValue: number): boolean {
  const rhsInfo = getListBounds(vm, rhsValue);
  if (!rhsInfo || !isList(rhsInfo.header)) {
    return false;
  }

  const rhsTag = getTag(rhsValue);
  const slotCount = getListLength(rhsInfo.header);
  const existingIsCompound = isList(slot.existingValue);

  if (!existingIsCompound) {
    if (slot.root.segment === SEG_GLOBAL) {
      initializeGlobalCompound(vm, slot, rhsInfo, rhsTag);
      return true;
    }
    discardCompoundSource(vm, rhsTag);
    throw new Error('Cannot assign simple to compound or compound to simple');
  }

  if (!isCompatible(slot.existingValue, rhsInfo.header)) {
    discardCompoundSource(vm, rhsTag);
    throw new Error('Incompatible compound assignment: slot count or type mismatch');
  }

  if (rhsTag === Tag.LIST) {
    // Absolute in-place update
    updateListInPlaceAbs(vm, slot.resolvedAbsAddr);
    return true;
  }

  // Absolute copy into resolved header location
  copyCompoundFromReference(vm, rhsInfo, slot.resolvedAbsAddr, slotCount);
  vm.pop();
  return true;
}

function storeSimpleValue(vm: VM, slot: SlotInfo, rhsValue: number): void {
  let value = rhsValue;
  if (isRef(value)) {
    value = readRefValueAbs(vm, value);
    vm.pop();
    vm.push(value);
  }

  const valueIsCompound = isList(value);
  const existingIsCompound = isList(slot.existingValue);
  if (!valueIsCompound && !existingIsCompound) {
    vm.pop();
    vm.memory.writeFloat32(SEG_DATA, slot.rootAbsAddr, value);
    return;
  }

  vm.pop();
  throw new Error('Cannot assign simple to compound or compound to simple');
}

export function storeOp(vm: VM): void {
  vm.ensureStackSize(2, 'store');
  const addressValue = vm.pop();
  const rhsTop = vm.peek();

  if (!isRef(addressValue)) {
    throw new Error('store expects DATA_REF address');
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
  vm.ensureStackSize(2, 'walk');
  const { value: idx } = fromTaggedValue(vm.pop());
  const target = vm.peek();
  const info = getListBounds(vm, target);
  if (!info || Tag.LIST !== Tag.LIST) {
    // Leave target, push idx (reset) and NIL
    vm.push(0);
    vm.push(NIL);
    return;
  }
  const slotCount = getListLength(info.header);
  if (idx >= slotCount || idx < 0) {
    vm.push(0);
    vm.push(NIL);
    return;
  }
  // Absolute addressing via unified data segment
  const headerAbsAddr = info.absBaseAddrBytes + slotCount * CELL_SIZE;
  const cellAbsAddr = headerAbsAddr - (idx + 1) * CELL_SIZE;
  const v = vm.memory.readFloat32(SEG_DATA, cellAbsAddr);
  const nextIdx = idx + 1;
  vm.push(nextIdx);
  if (isList(v)) {
    const absCellIndex = cellAbsAddr / CELL_SIZE;
    vm.push(createDataRefAbs(absCellIndex));
  } else {
    vm.push(v);
  }
}

export function findOp(vm: VM): void {
  vm.ensureStackSize(2, 'find');
  const key = vm.pop();
  const target = vm.peek();
  const info = getListBounds(vm, target);
  if (!info || !isList(info.header)) {
    vm.push(NIL);
    return;
  }
  const slotCount = getListLength(info.header);
  if (slotCount % 2 !== 0 || slotCount === 0) {
    vm.push(NIL);
    return;
  }
  const headerAbsAddr = info.absBaseAddrBytes + slotCount * CELL_SIZE;
  let defaultValueAddr = -1;
  for (let i = 0; i < slotCount; i += 2) {
    const keyAbsAddr = headerAbsAddr - CELL_SIZE - i * CELL_SIZE;
    const valueAbsAddr = headerAbsAddr - CELL_SIZE - (i + 1) * CELL_SIZE;
    const currentKey = vm.memory.readFloat32(SEG_DATA, keyAbsAddr);
    if (areValuesEqual(currentKey, key)) {
      const absCellIndex = valueAbsAddr / CELL_SIZE;
      vm.push(createDataRefAbs(absCellIndex));
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
    vm.push(createDataRefAbs(absCellIndex));
    return;
  }
  vm.push(NIL);
}

export function keysOp(vm: VM): void {
  vm.ensureStackSize(1, 'keys');
  const target = vm.peek();
  const info = getListBounds(vm, target);
  if (!info || !isList(info.header)) {
    vm.pop();
    vm.push(NIL);
    return;
  }
  const slotCount = getListLength(info.header);
  if (slotCount % 2 !== 0) {
    vm.pop();
    vm.push(NIL);
    return;
  }
  vm.pop();
  vm.push(info.header);
  if (slotCount === 0) {
    vm.push(toTaggedValue(0, Tag.LIST));
    return;
  }
  const keyCount = slotCount / 2;
  const headerAbsAddr = info.absBaseAddrBytes + slotCount * CELL_SIZE;
  for (let i = keyCount - 1; i >= 0; i--) {
    const keyAbsAddr = headerAbsAddr - CELL_SIZE - i * 2 * CELL_SIZE;
    const keyValue = vm.memory.readFloat32(SEG_DATA, keyAbsAddr);
    vm.push(keyValue);
  }
  vm.push(toTaggedValue(keyCount, Tag.LIST));
}

export function valuesOp(vm: VM): void {
  vm.ensureStackSize(1, 'values');
  const target = vm.peek();
  const info = getListBounds(vm, target);
  if (!info || !isList(info.header)) {
    vm.pop();
    vm.push(NIL);
    return;
  }
  const slotCount = getListLength(info.header);
  if (slotCount % 2 !== 0) {
    vm.pop();
    vm.push(NIL);
    return;
  }
  vm.pop();
  vm.push(info.header);
  if (slotCount === 0) {
    vm.push(toTaggedValue(0, Tag.LIST));
    return;
  }
  const valueCount = slotCount / 2;
  const headerAbsAddr = info.absBaseAddrBytes + slotCount * CELL_SIZE;
  for (let i = valueCount - 1; i >= 0; i--) {
    const valueAbsAddr = headerAbsAddr - CELL_SIZE - (i * 2 + 1) * CELL_SIZE;
    const valueValue = vm.memory.readFloat32(SEG_DATA, valueAbsAddr);
    vm.push(valueValue);
  }
  vm.push(toTaggedValue(valueCount, Tag.LIST));
}

export function refOp(vm: VM): void {
  vm.ensureStackSize(1, 'ref');
  const value = vm.peek();
  const tag = getTag(value);
  if (tag === Tag.LIST) {
    // sp is an absolute cell index; build absolute DATA_REF
    const headerCellIndex = vm.sp - 1;
    vm.push(createDataRefAbs(headerCellIndex));
  }
}

// resolveOp removed; use loadOp instead
