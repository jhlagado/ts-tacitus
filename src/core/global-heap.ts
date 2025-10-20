/**
 * @file src/core/global-heap.ts
 * Helpers for working with the Tacit global heap (stack-like global segment).
 */

import { VM } from './vm';
import { CELL_SIZE, GLOBAL_SIZE, SEG_GLOBAL } from './constants';
import { createGlobalRef } from './refs';
import { getListLength } from './list';
import { toTaggedValue, Tag, NIL } from './tagged';

const GLOBAL_CELL_CAPACITY = GLOBAL_SIZE / CELL_SIZE;

export interface ListSource {
  header: number;
  baseAddr: number;
  segment: number;
}

function ensureGlobalCapacity(vm: VM, cellsNeeded: number): void {
  if (cellsNeeded > 0 && vm.GP + cellsNeeded > GLOBAL_CELL_CAPACITY) {
    throw new Error('Global heap exhausted');
  }
}

export function pushSimpleToGlobalHeap(vm: VM, value: number): number {
  ensureGlobalCapacity(vm, 1);
  const cellIndex = vm.GP;
  const byteOffset = cellIndex * CELL_SIZE;
  vm.memory.writeFloat32(SEG_GLOBAL, byteOffset, value);
  vm.GP = cellIndex + 1;
  return createGlobalRef(cellIndex);
}

export function pushListToGlobalHeap(vm: VM, source: ListSource): number {
  const slotCount = getListLength(source.header);
  const span = slotCount + 1;
  ensureGlobalCapacity(vm, span);
  const destBaseCell = vm.GP;

  for (let i = 0; i < slotCount; i++) {
    const srcAddr = source.baseAddr + i * CELL_SIZE;
    const value = vm.memory.readFloat32(source.segment, srcAddr);
    vm.memory.writeFloat32(SEG_GLOBAL, (destBaseCell + i) * CELL_SIZE, value);
  }

  const headerCellIndex = destBaseCell + slotCount;
  vm.memory.writeFloat32(SEG_GLOBAL, headerCellIndex * CELL_SIZE, source.header);

  vm.GP = destBaseCell + span;
  return createGlobalRef(headerCellIndex);
}

export function getGlobalHeapSpan(vm: VM, headerValue: number): number {
  return getListLength(headerValue) + 1;
}

export interface DictionaryEntryHandles {
  entryRef: number;
  payloadRef: number;
}

export function pushDictionaryEntry(
  vm: VM,
  payload: number,
  name: number,
  prev: number = NIL,
): DictionaryEntryHandles {
  const slotCount = 3;
  const span = slotCount + 1;
  ensureGlobalCapacity(vm, span);
  const baseCell = vm.GP;

  vm.memory.writeFloat32(SEG_GLOBAL, (baseCell + 0) * CELL_SIZE, payload);
  vm.memory.writeFloat32(SEG_GLOBAL, (baseCell + 1) * CELL_SIZE, name);
  vm.memory.writeFloat32(SEG_GLOBAL, (baseCell + 2) * CELL_SIZE, prev);
  const headerCellIndex = baseCell + slotCount;
  vm.memory.writeFloat32(
    SEG_GLOBAL,
    headerCellIndex * CELL_SIZE,
    toTaggedValue(slotCount, Tag.LIST),
  );

  vm.GP = baseCell + span;
  const entryRef = createGlobalRef(headerCellIndex);
  const payloadRef = createGlobalRef(baseCell);
  return { entryRef, payloadRef };
}
