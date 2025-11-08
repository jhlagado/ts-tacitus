/**
 * @file src/ops/lists/query-ops.ts
 * Read-only and address-returning list operations (segment-aware).
 */

import type {
  VM } from '@src/core';
import {
  fromTaggedValue,
  toTaggedValue,
  Tag,
  NIL,
  dropList,
  pushListToGlobalHeap,
} from '@src/core';
import { getListLength, isList } from '@src/core';
import { CELL_SIZE, SEG_DATA, STACK_BASE, GLOBAL_BASE, RSTACK_BASE } from '@src/core';
import { getListBounds } from './core-helpers';
import { isRef, createDataRef, getByteAddressFromRef, readRefValue } from '@src/core';
import { dropOp } from '../stack';
import { isCompatible, updateListInPlace } from '../local-vars-transfer';
import { areValuesEqual, getTag } from '@src/core';
import { push, pop, peek, ensureStackSize } from '../../core/vm';
// (no longer using copyCells/cellIndex/cells in absolute migration paths)

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
  let currAddr = info.baseAddrBytes + slotCount * CELL_SIZE - CELL_SIZE;
  let remainingSlots = slotCount;
  while (remainingSlots > 0) {
    const v = vm.memory.readFloat32(SEG_DATA, currAddr);
    const span = isList(v) ? getListLength(v) + 1 : 1;
    elementCount++;
    remainingSlots -= span;
    currAddr -= span * CELL_SIZE;
  }
  dropOp(vm);
  push(vm, elementCount);
}

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
  push(vm, createDataRef(absCellIndex));
}

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
  let currentAddr = info.baseAddrBytes + slotCount * CELL_SIZE - CELL_SIZE;
  let currentLogicalIndex = 0;
  let remainingSlots = slotCount;

  while (remainingSlots > 0 && currentLogicalIndex <= idx) {
    const currentValue = vm.memory.readFloat32(SEG_DATA, currentAddr);
    let stepSize = 1;
    const elementStartAddr = currentAddr;

    if (isList(currentValue)) {
      stepSize = getListLength(currentValue) + 1;
    }

    if (currentLogicalIndex === idx) {
      const absCellIndex = elementStartAddr / CELL_SIZE;
      push(vm, createDataRef(absCellIndex));
      return;
    }

    currentAddr -= stepSize * CELL_SIZE;
    remainingSlots -= stepSize;
    currentLogicalIndex++;
  }

  push(vm, NIL);
}

export function fetchOp(vm: VM): void {
  ensureStackSize(vm, 1, 'fetch');
  const addressValue = pop(vm);
  if (!isRef(addressValue)) {
    throw new Error('fetch expects DATA_REF address');
  }
  // Absolute dereference
  const addr = getByteAddressFromRef(addressValue);
  const value = vm.memory.readFloat32(SEG_DATA, addr);
  if (isList(value)) {
    const slotCount = getListLength(value);
    for (let i = slotCount - 1; i >= 0; i--) {
      const slotValue = vm.memory.readFloat32(SEG_DATA, addr - (i + 1) * CELL_SIZE);
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
  let addr2 = getByteAddressFromRef(input);
  let value = vm.memory.readFloat32(SEG_DATA, addr2);

  // Optional second dereference if the loaded value is itself a reference
  if (isRef(value)) {
    addr2 = getByteAddressFromRef(value);
    value = vm.memory.readFloat32(SEG_DATA, addr2);
  }

  // Materialize if final value is a LIST header
  if (isList(value)) {
    const slotCount = getListLength(value);
    for (let i = slotCount - 1; i >= 0; i--) {
      const slotValue = vm.memory.readFloat32(SEG_DATA, addr2 - (i + 1) * CELL_SIZE);
      push(vm, slotValue);
    }
    push(vm, value);
    return;
  }

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
}

function resolveSlot(vm: VM, addressValue: number): SlotInfo {
  // Absolute-only resolution of slot location and (optional) one-level indirection
  const rootAbsAddr = getByteAddressFromRef(addressValue);
  const rootValue = vm.memory.readFloat32(SEG_DATA, rootAbsAddr);

  // Classify absolute address to legacy segment/address pair for compatibility
  const classify = (absAddr: number): SlotAddress => {
    if (absAddr >= GLOBAL_BASE && absAddr < STACK_BASE) {
      return { segment: 2, address: absAddr - GLOBAL_BASE };
    }
    if (absAddr >= STACK_BASE && absAddr < RSTACK_BASE) {
      return { segment: 0, address: absAddr - STACK_BASE };
    }
    return { segment: 1, address: absAddr - RSTACK_BASE };
  };

  let resolvedAbsAddr = rootAbsAddr;
  let existingValue = rootValue;
  if (isRef(rootValue)) {
    resolvedAbsAddr = getByteAddressFromRef(rootValue);
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
  vm.memory.writeFloat32(SEG_DATA, slot.rootAbsAddr, heapRef);
  discardCompoundSource(vm, rhsTag);
}

function copyCompoundFromReference(
  vm: VM,
  rhsInfo: { header: number; baseAddrBytes: number },
  targetAbsHeaderAddr: number,
  slotCount: number,
): void {
  // Absolute-only copy using unified data segment
  const srcBaseAbs = rhsInfo.baseAddrBytes;
  const targetBaseAbs = targetAbsHeaderAddr - slotCount * CELL_SIZE;

  for (let i = 0; i < slotCount; i++) {
    const v = vm.memory.readFloat32(SEG_DATA, srcBaseAbs + i * CELL_SIZE);
    vm.memory.writeFloat32(SEG_DATA, targetBaseAbs + i * CELL_SIZE, v);
  }
  const targetHeaderAbs = targetBaseAbs + slotCount * CELL_SIZE;
  vm.memory.writeFloat32(SEG_DATA, targetHeaderAbs, rhsInfo.header);
}

function tryStoreCompound(vm: VM, slot: SlotInfo, rhsValue: number): boolean {
  const rhsInfoAbs = getListBounds(vm, rhsValue);
  if (!rhsInfoAbs || !isList(rhsInfoAbs.header)) {
    return false;
  }

  const rhsTag = getTag(rhsValue);
  const slotCount = getListLength(rhsInfoAbs.header);
  const existingIsCompound = isList(slot.existingValue);

  if (!existingIsCompound) {
    // Prefer absolute address window over legacy segment label
    if (slot.rootAbsAddr >= GLOBAL_BASE && slot.rootAbsAddr < STACK_BASE) {
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
  const existingIsCompound = isList(slot.existingValue);
  if (!valueIsCompound && !existingIsCompound) {
    pop(vm);
    vm.memory.writeFloat32(SEG_DATA, slot.rootAbsAddr, value);
    return;
  }

  pop(vm);
  throw new Error('Cannot assign simple to compound or compound to simple');
}

export function storeOp(vm: VM): void {
  ensureStackSize(vm, 2, 'store');
  const addressValue = pop(vm);
  const rhsTop = peek(vm);

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
  ensureStackSize(vm, 2, 'walk');
  const { value: idx } = fromTaggedValue(pop(vm));
  const target = peek(vm);
  const info = getListBounds(vm, target);
  if (!info || Tag.LIST !== Tag.LIST) {
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
  const v = vm.memory.readFloat32(SEG_DATA, cellAbsAddr);
  const nextIdx = idx + 1;
  push(vm, nextIdx);
  if (isList(v)) {
    const absCellIndex = cellAbsAddr / CELL_SIZE;
    push(vm, createDataRef(absCellIndex));
  } else {
    push(vm, v);
  }
}

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
    const currentKey = vm.memory.readFloat32(SEG_DATA, keyAbsAddr);
    if (areValuesEqual(currentKey, key)) {
      const absCellIndex = valueAbsAddr / CELL_SIZE;
      push(vm, createDataRef(absCellIndex));
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
    push(vm, createDataRef(absCellIndex));
    return;
  }
  push(vm, NIL);
}

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
    const keyValue = vm.memory.readFloat32(SEG_DATA, keyAbsAddr);
    push(vm, keyValue);
  }
  push(vm, toTaggedValue(keyCount, Tag.LIST));
}

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
    const valueValue = vm.memory.readFloat32(SEG_DATA, valueAbsAddr);
    push(vm, valueValue);
  }
  push(vm, toTaggedValue(valueCount, Tag.LIST));
}

export function refOp(vm: VM): void {
  ensureStackSize(vm, 1, 'ref');
  const value = peek(vm);
  const tag = getTag(value);
  if (tag === Tag.LIST) {
    // sp is an absolute cell index; build absolute DATA_REF
    const headerCellIndex = vm.sp - 1;
    push(vm, createDataRef(headerCellIndex));
  }
}

// resolveOp removed; use loadOp instead
