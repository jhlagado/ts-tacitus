/**
 * @file src/ops/lists/query-ops.ts
 * Read-only and address-returning list operations (segment-aware).
 */

import { VM, fromTaggedValue, toTaggedValue, Tag, NIL } from '@src/core';
import { getListLength, getListElementAddress, isList } from '../../core/list';
import { CELL_SIZE } from '@src/core';
import { getListHeaderAndBase, computeHeaderAddr } from './core-helpers';
import { isRef, resolveReference, readReference, createSegmentRef } from '@src/core';
import { dropOp } from '../stack';
import { isCompoundData, isCompatibleCompound, mutateCompoundInPlace } from '../local-vars-transfer';
import { areValuesEqual, getTag } from '@src/core';

export function lengthOp(vm: VM): void {
  vm.ensureStackSize(1, 'length');
  const value = vm.peek();
  const info = getListHeaderAndBase(vm, value);
  let slotCount = -1;
  if (info && isList(info.header)) {
    slotCount = getListLength(info.header);
  }
  dropOp(vm);
  vm.push(slotCount);
}

export function sizeOp(vm: VM): void {
  vm.ensureStackSize(1, 'size');
  const value = vm.peek();
  const info = getListHeaderAndBase(vm, value);
  if (!info || !isList(info.header)) {
    dropOp(vm);
    vm.push(-1);
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
  const info = getListHeaderAndBase(vm, target);
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
  const info = getListHeaderAndBase(vm, target);
  if (!info || !isList(info.header)) {
    vm.push(NIL);
    return;
  }
  const slotCount = getListLength(info.header);
  const headerAddr = computeHeaderAddr(info.baseAddr, slotCount);
  const addr = getListElementAddress(vm, info.header, headerAddr, idx, info.segment);
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

export function storeOp(vm: VM): void {
  vm.ensureStackSize(2, 'store');
  const addressValue = vm.pop();
  let value = vm.peek();
  if (isRef(value)) {
    value = readReference(vm, value);
    vm.pop();
    vm.push(value);
  }
  if (!isRef(addressValue)) {
    throw new Error('store expects reference address (STACK_REF, RSTACK_REF, or GLOBAL_REF)');
  }
  const { address, segment } = resolveReference(vm, addressValue);
  const valueInSlot = vm.memory.readFloat32(segment, address);
  let existingValue = valueInSlot;
  if (isRef(valueInSlot)) {
    const resolved = resolveReference(vm, valueInSlot);
    existingValue = vm.memory.readFloat32(resolved.segment, resolved.address);
  }
  const valueIsCompound = isCompoundData(value);
  const existingIsCompound = isCompoundData(existingValue);
  if (valueIsCompound && existingIsCompound) {
    if (isCompatibleCompound(existingValue, value)) {
      const { address: targetAddress, segment: targetSegment } = resolveReference(vm, valueInSlot);
      mutateCompoundInPlace(vm, targetAddress, targetSegment);
    } else {
      vm.pop();
      throw new Error('Incompatible compound assignment: slot count or type mismatch');
    }
  } else if (!valueIsCompound && !existingIsCompound) {
    vm.pop();
    vm.memory.writeFloat32(segment, address, value);
  } else {
    vm.pop();
    throw new Error('Cannot assign simple to compound or compound to simple');
  }
}

export function findOp(vm: VM): void {
  vm.ensureStackSize(2, 'find');
  const key = vm.pop();
  const target = vm.peek();
  const info = getListHeaderAndBase(vm, target);
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
  const info = getListHeaderAndBase(vm, target);
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
  const info = getListHeaderAndBase(vm, target);
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
    const headerCellIndex = (vm.SP - 4) / 4;
    vm.push(createSegmentRef(0, headerCellIndex));
  }
}

export function resolveOp(vm: VM): void {
  vm.ensureStackSize(1, 'resolve');
  const value = vm.pop();
  if (isRef(value)) {
    const { address, segment } = resolveReference(vm, value);
    const referencedValue = vm.memory.readFloat32(segment, address);
    if (isList(referencedValue)) {
      const slotCount = getListLength(referencedValue);
      for (let i = 0; i < slotCount; i++) {
        const slotValue = vm.memory.readFloat32(segment, address - (slotCount - i) * CELL_SIZE);
        vm.push(slotValue);
      }
      vm.push(referencedValue);
    } else {
      vm.push(referencedValue);
    }
  } else {
    vm.push(value);
  }
}
