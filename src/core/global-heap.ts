/**
 * @file src/core/global-heap.ts
 * Helpers for working with the Tacit global heap (stack-like global segment).
 */

import { VM } from './vm';
import { CELL_SIZE, GLOBAL_SIZE, SEG_DATA, GLOBAL_BASE } from './constants';
import { createGlobalRef } from './refs';
import { getListLength } from './list';

const GLOBAL_CELL_CAPACITY = GLOBAL_SIZE / CELL_SIZE;

export interface ListSource {
  /** LIST header value to write at destination */
  header: number;
  /** Absolute byte address of the first payload cell in the source */
  absBaseAddrBytes: number;
}

function ensureGlobalCapacity(vm: VM, cellsNeeded: number): void {
  if (cellsNeeded > 0 && vm.gp + cellsNeeded > GLOBAL_CELL_CAPACITY) {
    throw new Error('Global heap exhausted');
  }
}

export function pushSimpleToGlobalHeap(vm: VM, value: number): number {
  ensureGlobalCapacity(vm, 1);
  const cellIndex = vm.gp;
  const byteOffset = cellIndex * CELL_SIZE;
  vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE + byteOffset, value);
  vm.gp = cellIndex + 1;
  return createGlobalRef(cellIndex);
}

export function pushListToGlobalHeap(vm: VM, source: ListSource): number {
  const slotCount = getListLength(source.header);
  const span = slotCount + 1;
  ensureGlobalCapacity(vm, span);
  const destBaseCell = vm.gp;

  // Absolute-only source base for unified reads
  const srcBaseAbs = source.absBaseAddrBytes;

  for (let i = 0; i < slotCount; i++) {
    const value = vm.memory.readFloat32(SEG_DATA, srcBaseAbs + i * CELL_SIZE);
    vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE + (destBaseCell + i) * CELL_SIZE, value);
  }

  const headerCellIndex = destBaseCell + slotCount;
  vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE + headerCellIndex * CELL_SIZE, source.header);

  vm.gp = destBaseCell + span;
  return createGlobalRef(headerCellIndex);
}

export function getGlobalHeapSpan(vm: VM, headerValue: number): number {
  return getListLength(headerValue) + 1;
}

// Dictionary composition intentionally lives in dictionary-heap.ts
