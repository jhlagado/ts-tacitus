/**
 * @file src/ops/local-vars-transfer.ts
 * Compound data transfer operations for local variables
 */

import {
  type VM,
  getTag,
  Tag,
  getListLength,
  validateListHeader,
  isList,
  STACK_BASE,
  RSTACK_BASE,
  CELL_SIZE,
  dropList,
  copyListPayload,
} from '@src/core';
import { rdepth, push, peek, ensureStackSize, rpush } from '../core/vm';


/**
 * Transfers compound data from data stack to return stack.
 * Maintains Tacit's stack-native list encoding during transfer.
 *
 * Stack effect: ( list -- ) [transfers to return stack]
 * Returns: byte address of LIST header on return stack
 *
 * Example:
 * - Data stack: [3, 2, 1, LIST:3] ← TOS
 * - Transfer: rpush(3), rpush(2), rpush(1), rpush(LIST:3)
 * - Return stack result: [LIST:3, 1, 2, 3] ← LIST:3 at TOS
 */
export function rpushList(vm: VM): number {
  validateListHeader(vm);
  const header = peek(vm);
  const slotCount = getListLength(header);

  if (slotCount === 0) {
    // Compute header byte address from cell-oriented RSP to avoid direct RP usage
    const headerAddr = rdepth(vm) * CELL_SIZE;
    rpush(vm, header);
    dropList(vm);
    return headerAddr;
  }

  // Data stack is cell-indexed; compute first element cell (relative to STACK_BASE) and stream-copy to RSTACK via rpush
  let elementCell = vm.sp - STACK_BASE - (slotCount + 1);
  for (let i = 0; i < slotCount; i++) {
    const value = vm.memory.readCell(STACK_BASE + elementCell);
    rpush(vm, value);
    elementCell += 1;
  }
  // Compute header byte address from cell-oriented RSP (RP accessor removed)
  const headerAddr = rdepth(vm) * CELL_SIZE;
  rpush(vm, header);
  dropList(vm);

  return headerAddr;
}

/**
 * Transfers compound data from return stack back to data stack.
 * Used for materializing compound local variables.
 *
 * Parameters: headerAddr - byte address of LIST header on return stack
 * Stack effect: ( -- list ) [materializes from return stack]
 */
export function loadListFromReturn(vm: VM, headerAddr: number): void {
  const headerCellIndex = RSTACK_BASE + headerAddr / CELL_SIZE;
  const header = vm.memory.readCell(headerCellIndex);

  if (!isList(header)) {
    throw new Error('Expected LIST header');
  }

  const slotCount = getListLength(header);

  if (slotCount === 0) {
    push(vm, header);
    return;
  }

  const headerCell = headerAddr / CELL_SIZE;
  const baseCell = headerCell - slotCount;
  for (let i = 0; i < slotCount; i++) {
    const element = vm.memory.readCell(RSTACK_BASE + baseCell + i);
    push(vm, element);
  }
  push(vm, header);
}


/**
 * Checks if two compound values are compatible for mutation.
 *
 * Compatibility requirements from lists.md §10:
 * - Same compound type (LIST can only replace LIST)
 * - Same total slot count (header + payload slots)
 * - No recursive analysis needed - just check outer header
 *
 * @param existing The existing compound value at target location
 * @param newValue The new compound value being assigned
 * @returns true if compatible, false otherwise
 */
export function isCompatible(existing: number, newValue: number): boolean {
  const existingTag = getTag(existing);
  const newTag = getTag(newValue);

  if (existingTag !== newTag) {
    return false;
  }
  if (existingTag !== Tag.LIST) {
    return false;
  }
  const existingSlots = getListLength(existing);
  const newSlots = getListLength(newValue);

  return existingSlots === newSlots;
}

/**
 * Updates list in-place at absolute address.
 * Key differences from rpushList:
 * - NO RSP advancement (overwrites existing space)
 * - Uses provided targetAddr instead of current RSP
 * - For variable mutation, not initialization
 *
 * @param vm The VM instance
 * @param targetAbsHeaderAddr Absolute byte address of existing compound data header (SEG_DATA)
 */
export function updateListInPlace(vm: VM, targetAbsHeaderAddr: number): void {
  ensureStackSize(vm, 1, 'updateListInPlace');
  const header = peek(vm);

  if (!isList(header)) {
    throw new Error('updateListInPlace expects list data');
  }

  validateListHeader(vm);
  const slotCount = getListLength(header);
  const targetHeaderCell = targetAbsHeaderAddr / CELL_SIZE;
  const existingHeader = vm.memory.readCell(targetHeaderCell);
  if (!isCompatible(existingHeader, header)) {
    throw new Error('Incompatible compound assignment: slot count or type mismatch');
  }

  if (slotCount === 0) {
    vm.memory.writeCell(targetHeaderCell, header);
    dropList(vm);
    return;
  }

  // Source cells from data stack (relative to STACK_BASE for reads below)
  const srcBaseCell = vm.sp - STACK_BASE - (slotCount + 1);
  const targetBaseCell = targetHeaderCell - slotCount;
  copyListPayload(vm, STACK_BASE + srcBaseCell, targetBaseCell, slotCount);
  vm.memory.writeCell(targetHeaderCell, header);
  dropList(vm);
}

export { isList } from '@src/core';
