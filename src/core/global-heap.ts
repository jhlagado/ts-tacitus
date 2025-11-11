/**
 * @file src/core/global-heap.ts
 * Helpers for working with the Tacit global heap (stack-like global segment).
 */

import { type VM, peek } from './vm';
import { CELL_SIZE, GLOBAL_SIZE, GLOBAL_BASE, STACK_BASE } from './constants';
import { createGlobalRef } from './refs';
import { getListLength, validateListHeader, dropList, copyListPayload } from './list';

function ensureGlobalCapacity(vm: VM, cellsNeeded: number): void {
  if (cellsNeeded > 0 && vm.gp + cellsNeeded > GLOBAL_SIZE) {
    throw new Error('Global heap exhausted');
  }
}

export type ListSource = {
  /** LIST header value to write at destination */
  header: number;
  /** Cell index of the first payload cell in the source */
  baseCell: number;
};

/**
 * Pushes a simple value to the global heap and returns a REF.
 * @param vm - VM instance
 * @param value - Value to push
 * @returns REF to the allocated global cell
 * @throws {Error} If global heap is exhausted
 */
export function gpushVal(vm: VM, value: number): number {
  ensureGlobalCapacity(vm, 1);
  const idx = vm.gp;
  vm.memory.writeCell(GLOBAL_BASE + idx, value);
  vm.gp = idx + 1;
  return createGlobalRef(idx);
}

/**
 * Pushes a list to the global heap from a memory source and returns a REF to the header.
 * @param vm - VM instance
 * @param source - List source containing header and base address
 * @returns REF to the list header in global heap
 * @throws {Error} If global heap is exhausted
 */
export function gpushListFrom(vm: VM, source: ListSource): number {
  const n = getListLength(source.header);
  const span = n + 1;
  ensureGlobalCapacity(vm, span);
  const dst = vm.gp;
  copyListPayload(vm, source.baseCell, GLOBAL_BASE + dst, n);
  const hdr = dst + n;
  vm.memory.writeCell(GLOBAL_BASE + hdr, source.header);
  vm.gp = dst + span;
  return createGlobalRef(hdr);
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
  const h = peek(vm);
  const n = getListLength(h);

  if (n === 0) {
    ensureGlobalCapacity(vm, 1);
    const hdr = vm.gp;
    vm.memory.writeCell(GLOBAL_BASE + hdr, h);
    vm.gp = hdr + 1;
    dropList(vm);
    return createGlobalRef(hdr);
  }

  ensureGlobalCapacity(vm, n + 1);
  const dst = vm.gp;
  const src = vm.sp - STACK_BASE - (n + 1);
  copyListPayload(vm, STACK_BASE + src, GLOBAL_BASE + dst, n);
  const hdr = dst + n;
  vm.memory.writeCell(GLOBAL_BASE + hdr, h);
  vm.gp = hdr + 1;
  dropList(vm);
  return createGlobalRef(hdr);
}
