/**
 * @file src/ops/local-vars-transfer.ts
 * Compound data transfer operations for local variables
 */

import {
  type VM,
  getTaggedInfo,
  Tag,
  getListLength,
  validateListHeader,
  isList,
  STACK_BASE,
  RSTACK_BASE,
  dropList,
  copyListPayload,
  memoryReadCell,
  memoryWriteCell,
} from '@src/core';
import { rdepth, push, peek, ensureStackSize, rpush } from '../core/vm';

/**
 * Transfers compound data from data stack to return stack.
 * Maintains Tacit's stack-native list encoding during transfer.
 *
 * Stack effect: ( list -- ) [transfers to return stack]
 * Returns: relative cell index of LIST header on return stack (from RSTACK_BASE)
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
    const headerCell = rdepth(vm);
    rpush(vm, header);
    dropList(vm);
    return headerCell;
  }

  let elementCell = vm.sp - STACK_BASE - (slotCount + 1);
  for (let i = 0; i < slotCount; i++) {
    const value = memoryReadCell(vm.memory, STACK_BASE + elementCell);
    rpush(vm, value);
    elementCell += 1;
  }
  const headerCell = rdepth(vm);
  rpush(vm, header);
  dropList(vm);

  return headerCell;
}

/**
 * Transfers compound data from return stack back to data stack.
 * Used for materializing compound local variables.
 *
 * Parameters: headerCell - relative cell index of LIST header on return stack (from RSTACK_BASE)
 * Stack effect: ( -- list ) [materializes from return stack]
 */
export function loadListFromReturn(vm: VM, headerCell: number): void {
  const headerCellIndex = RSTACK_BASE + headerCell;
  const header = memoryReadCell(vm.memory, headerCellIndex);

  if (!isList(header)) {
    throw new Error('Expected LIST header');
  }

  const slotCount = getListLength(header);

  if (slotCount === 0) {
    push(vm, header);
    return;
  }

  const baseCell = headerCell - slotCount;
  for (let i = 0; i < slotCount; i++) {
    const element = memoryReadCell(vm.memory, RSTACK_BASE + baseCell + i);
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
  const { tag: existingTag } = getTaggedInfo(existing);
  const { tag: newTag } = getTaggedInfo(newValue);

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
 * Updates list in-place at target cell.
 * Key differences from rpushList:
 * - NO RSP advancement (overwrites existing space)
 * - Uses provided target cell instead of current RSP
 * - For variable mutation, not initialization
 *
 * @param vm The VM instance
 * @param targetHeaderCell Cell index of existing compound data header
 */
export function updateList(vm: VM, targetHeaderCell: number): void {
  ensureStackSize(vm, 1, 'updateList');
  const header = peek(vm);

  if (!isList(header)) {
    throw new Error('updateList expects list data');
  }

  validateListHeader(vm);
  const slotCount = getListLength(header);
  const existingHeader = memoryReadCell(vm.memory, targetHeaderCell);
  if (!isCompatible(existingHeader, header)) {
    throw new Error('Incompatible compound assignment: slot count or type mismatch');
  }

  if (slotCount === 0) {
    memoryWriteCell(vm.memory, targetHeaderCell, header);
    dropList(vm);
    return;
  }

  // Source cells from data stack (relative to STACK_BASE for reads below)
  const srcBaseCell = vm.sp - STACK_BASE - (slotCount + 1);
  const targetBaseCell = targetHeaderCell - slotCount;
  copyListPayload(vm, STACK_BASE + srcBaseCell, targetBaseCell, slotCount);
  memoryWriteCell(vm.memory, targetHeaderCell, header);
  dropList(vm);
}

export { isList } from '@src/core';
