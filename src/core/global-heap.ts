/**
 * @file src/core/global-heap.ts
 * Helpers for working with the Tacit global heap (stack-like global segment).
 */

import type { VM } from './vm';
import { CELL_SIZE, GLOBAL_SIZE_CELLS, GLOBAL_BASE_CELLS } from './constants';
import { createGlobalRef } from './refs';
import { getListLength } from './list';

const GLOBAL_CELL_CAPACITY = GLOBAL_SIZE_CELLS;

export type ListSource = {
  /** LIST header value to write at destination */
  header: number;
  /** Absolute byte address of the first payload cell in the source */
  baseAddrBytes: number;
}

function ensureGlobalCapacity(vm: VM, cellsNeeded: number): void {
  if (cellsNeeded > 0 && vm.gp + cellsNeeded > GLOBAL_CELL_CAPACITY) {
    throw new Error('Global heap exhausted');
  }
}

/**
 * Pushes a simple value to the global heap and returns a REF.
 * @param vm - VM instance
 * @param value - Value to push
 * @returns REF to the allocated global cell
 * @throws {Error} If global heap is exhausted
 */
export function pushSimpleToGlobalHeap(vm: VM, value: number): number {
  ensureGlobalCapacity(vm, 1);
  const cellIndex = vm.gp;
  vm.memory.writeCell(GLOBAL_BASE_CELLS + cellIndex, value);
  vm.gp = cellIndex + 1;
  return createGlobalRef(cellIndex);
}

/**
 * Pushes a list to the global heap and returns a REF to the header.
 * @param vm - VM instance
 * @param source - List source containing header and base address
 * @returns REF to the list header in global heap
 * @throws {Error} If global heap is exhausted
 */
export function pushListToGlobalHeap(vm: VM, source: ListSource): number {
  const slotCount = getListLength(source.header);
  const span = slotCount + 1;
  ensureGlobalCapacity(vm, span);
  const destBaseCell = vm.gp;

  const srcBaseCells = source.baseAddrBytes / CELL_SIZE;

  for (let i = 0; i < slotCount; i++) {
    const value = vm.memory.readCell(srcBaseCells + i);
    vm.memory.writeCell(GLOBAL_BASE_CELLS + destBaseCell + i, value);
  }

  const headerCellIndex = destBaseCell + slotCount;
  vm.memory.writeCell(GLOBAL_BASE_CELLS + headerCellIndex, source.header);

  vm.gp = destBaseCell + span;
  return createGlobalRef(headerCellIndex);
}

/**
 * Gets the span (cell count) for a list in the global heap.
 * @param _vm - VM instance (unused)
 * @param headerValue - LIST header tagged value
 * @returns Number of cells occupied (payload + header)
 */
export function getGlobalHeapSpan(_vm: VM, headerValue: number): number {
  return getListLength(headerValue) + 1;
}
