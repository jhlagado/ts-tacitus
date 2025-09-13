/**
 * @file src/ops/lists/query-ops.ts
 * Read-only and address-returning list operations (segment-aware).
 */

import { VM, fromTaggedValue, toTaggedValue, Tag, NIL } from '@src/core';
import { getListLength, getListElemAddr, isList } from '@src/core';
import { CELL_SIZE, SEG_GLOBAL, GLOBAL_SIZE } from '@src/core';
import { getListBounds, computeHeaderAddr } from './core-helpers';
import { isRef, resolveReference, readReference, createSegmentRef } from '@src/core';
import { dropOp } from '../stack';
import { isCompatible, updateListInPlace } from '../local-vars-transfer';
import { areValuesEqual, getTag } from '@src/core';
import { copyCells, cellIndex, cells } from '../../core/units';

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
  let elementCount = 0;
  let currentAddr = computeHeaderAddr(info.baseAddr, slotCount) - CELL_SIZE;
  let remainingSlots = slotCount;
  while (remainingSlots > 0) {
    const v = vm.memory.readFloat32(info.segment, currentAddr);
    const span = isList(v) ? getListLength(v) + 1 : 1;
    elementCount++;
    remainingSlots -= span;
    currentAddr -= span * CELL_SIZE;
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
  const headerAddr = computeHeaderAddr(info.baseAddr, slotCount);
  const addr = headerAddr - (idx + 1) * CELL_SIZE;
  const cellIndex = addr / CELL_SIZE;
  vm.push(createSegmentRef(info.segment, cellIndex));
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
  const headerAddr = computeHeaderAddr(info.baseAddr, slotCount);
  const addr = getListElemAddr(vm, info.header, headerAddr, idx, info.segment);
  if (addr === -1) {
    vm.push(NIL);
    return;
  }
  const cellIndex = addr / CELL_SIZE;
  vm.push(createSegmentRef(info.segment, cellIndex));
}

export function fetchOp(vm: VM): void {
  vm.ensureStackSize(1, 'fetch');
  const addressValue = vm.pop();
  if (!isRef(addressValue)) {
    throw new Error('fetch expects reference address (STACK_REF, RSTACK_REF, or GLOBAL_REF)');
  }
  const { address, segment } = resolveReference(vm, addressValue);
  const value = vm.memory.readFloat32(segment, address);
  if (isList(value)) {
    const slotCount = getListLength(value);
    for (let i = slotCount - 1; i >= 0; i--) {
      const slotValue = vm.memory.readFloat32(segment, address - (i + 1) * CELL_SIZE);
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

  // First dereference
  const first = resolveReference(vm, input);
  let addr = first.address;
  let seg = first.segment;
  let value = vm.memory.readFloat32(seg, addr);

  // Optional second dereference if the loaded value is itself a reference
  if (isRef(value)) {
    const second = resolveReference(vm, value);
    seg = second.segment;
    addr = second.address;
    value = vm.memory.readFloat32(seg, addr);
  }

  // Materialize if final value is a LIST header
  if (isList(value)) {
    const slotCount = getListLength(value);
    for (let i = slotCount - 1; i >= 0; i--) {
      const slotValue = vm.memory.readFloat32(seg, addr - (i + 1) * CELL_SIZE);
      vm.push(slotValue);
    }
    vm.push(value);
    return;
  }

  vm.push(value);
}

export function storeOp(vm: VM): void {
  vm.ensureStackSize(2, 'store');
  const addressValue = vm.pop();
  const rhsTop = vm.peek();

  if (!isRef(addressValue)) {
    throw new Error('store expects reference address (STACK_REF, RSTACK_REF, or GLOBAL_REF)');
  }

  // Resolve destination slot and read existing value for compatibility checks.
  const dest = resolveReference(vm, addressValue);
  const valueInSlot = vm.memory.readFloat32(dest.segment, dest.address);
  let existingValue = valueInSlot;
  if (isRef(valueInSlot)) {
    const resolved = resolveReference(vm, valueInSlot);
    existingValue = vm.memory.readFloat32(resolved.segment, resolved.address);
  }

  // Attempt compound path first, using unified header/base resolver. This handles both
  // materialized lists (Tag.LIST at TOS) and refs-to-lists. We will:
  // - If materialized: use updateListInPlace (existing behavior)
  // - If ref-to-list: perform direct ref→ref copy without materializing
  const rhsInfo = getListBounds(vm, rhsTop);
  if (rhsInfo && isList(rhsInfo.header)) {
    const existingIsCompound = isList(existingValue);
    if (!existingIsCompound) {
      // Initialization path for globals: allocate region in SEG_GLOBAL and bind slot to it
      if (dest.segment === SEG_GLOBAL) {
        const slotCount = getListLength(rhsInfo.header);
        // Allocate slotCount (payload) + 1 (header) cells in global segment
        const neededCells = slotCount + 1;
        const maxCells = GLOBAL_SIZE / CELL_SIZE;
        const baseCells = (vm as any)._globalTopCells ?? 0;
        if (baseCells + neededCells > maxCells) {
          vm.pop();
          throw new Error('Global segment exhausted while allocating compound');
        }
        const baseAddr = baseCells * CELL_SIZE;
        // Copy payload
        for (let i = 0; i < slotCount; i++) {
          const srcAddr = rhsInfo.baseAddr + i * CELL_SIZE;
          const v = vm.memory.readFloat32(rhsInfo.segment, srcAddr);
          vm.memory.writeFloat32(SEG_GLOBAL, baseAddr + i * CELL_SIZE, v);
        }
        // Write header
        const headerAddr = baseAddr + slotCount * CELL_SIZE;
        vm.memory.writeFloat32(SEG_GLOBAL, headerAddr, rhsInfo.header);
        // Rebind slot: write GLOBAL_REF(headerCellIndex) into the destination slot
        const headerCellIndex = headerAddr / CELL_SIZE;
        vm.memory.writeFloat32(dest.segment, dest.address, toTaggedValue(headerCellIndex, Tag.GLOBAL_REF));
        // Advance global top pointer
        (vm as any)._globalTopCells = baseCells + slotCount + 1;
        // Pop the source list from data stack: header + payload
        vm.pop();
        for (let i = 0; i < slotCount; i++) vm.pop();
        return;
      }
      // Cannot assign compound to simple (non-global destinations)
      vm.pop();
      throw new Error('Cannot assign simple to compound or compound to simple');
    }

    // Validate compatibility against destination's existing compound header
    if (!isCompatible(existingValue, rhsInfo.header)) {
      vm.pop();
      throw new Error('Incompatible compound assignment: slot count or type mismatch');
    }

    // Determine destination write location: either the resolved destination address itself,
    // or, if the slot holds a reference, resolve it to get the true header address.
    let targetAddress = dest.address;
    let targetSegment = dest.segment;
    if (isRef(valueInSlot)) {
      const resolved = resolveReference(vm, valueInSlot);
      targetAddress = resolved.address;
      targetSegment = resolved.segment;
    }

    const slotCount = getListLength(rhsInfo.header);

    // If RHS is materialized on the data stack (Tag.LIST), retain existing fast path:
    // write from stack via updateListInPlace which also drops the materialized list.
    if (getTag(rhsTop) === Tag.LIST) {
      updateListInPlace(vm, targetAddress, targetSegment);
      return;
    }

    // RHS is a ref-to-list. Copy directly from source memory to destination
    // without materializing, with overlap safety via a scratch buffer.
    const srcHeaderAddr = computeHeaderAddr(rhsInfo.baseAddr, slotCount);
    const destBaseAddr = targetAddress - slotCount * CELL_SIZE;

    // Early no-op if source and destination are the exact same region
    if (
      rhsInfo.segment === targetSegment &&
      rhsInfo.baseAddr === destBaseAddr &&
      srcHeaderAddr === targetAddress
    ) {
      vm.pop();
      return;
    }

    if (rhsInfo.segment === targetSegment) {
      // Same-segment fast path: copy payload via u32.copyWithin (memmove semantics)
      const srcBaseCell = rhsInfo.baseAddr / CELL_SIZE;
      const dstBaseCell = destBaseAddr / CELL_SIZE;
      copyCells(vm.memory, targetSegment, cellIndex(dstBaseCell), cellIndex(srcBaseCell), cells(slotCount));
      // Write header last
      vm.memory.writeFloat32(targetSegment, targetAddress, rhsInfo.header);
    } else {
      // Cross-segment fallback: stage into a temporary buffer
      const tmp: number[] = new Array(slotCount);
      for (let i = 0; i < slotCount; i++) {
        const addr = rhsInfo.baseAddr + i * CELL_SIZE;
        tmp[i] = vm.memory.readFloat32(rhsInfo.segment, addr);
      }
      for (let i = 0; i < slotCount; i++) {
        const addr = destBaseAddr + i * CELL_SIZE;
        vm.memory.writeFloat32(targetSegment, addr, tmp[i]);
      }
      // Then write header last
      vm.memory.writeFloat32(targetSegment, targetAddress, rhsInfo.header);
    }

    // Stack effect mirrors simple store: pop one RHS value
    vm.pop();
    return;
  }

  // Simple path: scalar or non-compound values. Maintain prior behavior:
  // If RHS is a ref, dereference once and replace TOS with that single value.
  let value = rhsTop;
  if (isRef(value)) {
    value = readReference(vm, value);
    vm.pop();
    vm.push(value);
  }

  const valueIsCompound = isList(value);
  const existingIsCompound = isList(existingValue);
  if (!valueIsCompound && !existingIsCompound) {
  vm.pop();
    vm.memory.writeFloat32(dest.segment, dest.address, value);
    return;
  }

  // Remaining mismatches error out like before
  vm.pop();
  throw new Error('Cannot assign simple to compound or compound to simple');
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
  const headerAddr = computeHeaderAddr(info.baseAddr, slotCount);
  const cellAddr = headerAddr - (idx + 1) * CELL_SIZE;
  const v = vm.memory.readFloat32(info.segment, cellAddr);
  const nextIdx = idx + 1;
  vm.push(nextIdx);
  if (isList(v)) {
    const cellIndex = cellAddr / CELL_SIZE;
    vm.push(createSegmentRef(info.segment, cellIndex));
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
  const headerAddr = computeHeaderAddr(info.baseAddr, slotCount);
  let defaultValueAddr = -1;
  for (let i = 0; i < slotCount; i += 2) {
    const keyAddr = headerAddr - CELL_SIZE - i * CELL_SIZE;
    const valueAddr = headerAddr - CELL_SIZE - (i + 1) * CELL_SIZE;
    const currentKey = vm.memory.readFloat32(info.segment, keyAddr);
    if (areValuesEqual(currentKey, key)) {
      const cellIndex = valueAddr / CELL_SIZE;
      vm.push(createSegmentRef(info.segment, cellIndex));
      return;
    }
    const { tag: keyTag, value: keyValue } = fromTaggedValue(currentKey);
    if (keyTag === Tag.STRING) {
      const keyStr = vm.digest.get(keyValue);
      if (keyStr === 'default') {
        defaultValueAddr = valueAddr;
      }
    }
  }
  if (defaultValueAddr !== -1) {
    const cellIndex = defaultValueAddr / CELL_SIZE;
    vm.push(createSegmentRef(info.segment, cellIndex));
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
  const headerAddr = info.baseAddr + slotCount * CELL_SIZE;
  for (let i = keyCount - 1; i >= 0; i--) {
    const keyAddr = headerAddr - CELL_SIZE - i * 2 * CELL_SIZE;
    const keyValue = vm.memory.readFloat32(info.segment, keyAddr);
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
  const headerAddr = info.baseAddr + slotCount * CELL_SIZE;
  for (let i = valueCount - 1; i >= 0; i--) {
    const valueAddr = headerAddr - CELL_SIZE - (i * 2 + 1) * CELL_SIZE;
    const valueValue = vm.memory.readFloat32(info.segment, valueAddr);
    vm.push(valueValue);
  }
  vm.push(toTaggedValue(valueCount, Tag.LIST));
}

export function refOp(vm: VM): void {
  vm.ensureStackSize(1, 'ref');
  const value = vm.peek();
  const tag = getTag(value);
  if (tag === Tag.LIST) {
    const headerCellIndex = vm.SPCells - 1;
    vm.push(createSegmentRef(0, headerCellIndex));
  }
}

// resolveOp removed; use loadOp instead
