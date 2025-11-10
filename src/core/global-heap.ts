/**
 * @file src/core/global-heap.ts
 * Helpers for working with the Tacit global heap (stack-like global segment).
 */

import { type VM, peek } from './vm';
import { CELL_SIZE, GLOBAL_SIZE, GLOBAL_BASE, STACK_BASE } from './constants';
import { createGlobalRef } from './refs';
import { getListLength, validateListHeader, dropList } from './list';

const GLOBAL_CELL_CAPACITY = GLOBAL_SIZE;

function ensureGlobalCapacity(vm: VM, cellsNeeded: number): void {
  if (cellsNeeded > 0 && vm.gp + cellsNeeded > GLOBAL_CELL_CAPACITY) {
    throw new Error('Global heap exhausted');
  }
}

export type ListSource = {
  /** LIST header value to write at destination */
  header: number;
  /** Absolute byte address of the first payload cell in the source */
  baseAddrBytes: number;
};

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
  vm.memory.writeCell(GLOBAL_BASE + cellIndex, value);
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
    vm.memory.writeCell(GLOBAL_BASE + destBaseCell + i, value);
  }

  const headerCellIndex = destBaseCell + slotCount;
  vm.memory.writeCell(GLOBAL_BASE + headerCellIndex, source.header);

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

/**
 * Transfers compound data from data stack to global heap.
 * Mirrors rpushList but for global heap instead of return stack.
 *
 * Stack effect: ( list -- ) [transfers to global heap]
 * Returns: REF to the LIST header in global heap
 *
 * @param vm - VM instance
 * @returns REF to the list header in global heap
 */
export function gpushList(vm: VM): number {
  validateListHeader(vm);
  const header = peek(vm);
  const slotCount = getListLength(header);

  if (slotCount === 0) {
    // Empty list: just write header and return REF
    ensureGlobalCapacity(vm, 1);
    const headerCellIndex = vm.gp;
    vm.memory.writeCell(GLOBAL_BASE + headerCellIndex, header);
    vm.gp = headerCellIndex + 1;
    dropList(vm);
    return createGlobalRef(headerCellIndex);
  }

  // Copy payload slots from data stack to global heap
  ensureGlobalCapacity(vm, slotCount + 1);
  const destBaseCell = vm.gp;

  // Data stack is cell-indexed; compute first element cell (relative to STACK_BASE)
  let elementCell = vm.sp - STACK_BASE - (slotCount + 1);
  for (let i = 0; i < slotCount; i++) {
    const value = vm.memory.readCell(STACK_BASE + elementCell);
    vm.memory.writeCell(GLOBAL_BASE + destBaseCell + i, value);
    elementCell += 1;
  }

  // Write header and update gp
  const headerCellIndex = destBaseCell + slotCount;
  vm.memory.writeCell(GLOBAL_BASE + headerCellIndex, header);
  vm.gp = headerCellIndex + 1;

  dropList(vm);
  return createGlobalRef(headerCellIndex);
}
