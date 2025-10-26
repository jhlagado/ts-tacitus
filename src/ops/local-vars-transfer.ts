/**
 * @file src/ops/local-vars-transfer.ts
 * Compound data transfer operations for local variables
 */

import {
  VM,
  getTag,
  Tag,
  getListLength,
  validateListHeader,
  isList,
  SEG_DATA,
  STACK_BASE,
  STACK_BASE_CELLS,
  RSTACK_BASE,
  RSTACK_BASE_CELLS,
  CELL_SIZE,
  dropList,
} from '@src/core';

// Helpers for cell-oriented reasoning on return-stack-resident compounds
function headerAddrToHeaderCell(headerAddrBytes: number): number {
  return headerAddrBytes / CELL_SIZE;
}

function computeBaseCellFromHeader(headerCell: number, slotCount: number): number {
  return headerCell - slotCount;
}

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
  const header = vm.peek();
  const slotCount = getListLength(header);

  if (slotCount === 0) {
    // Compute header byte address from cell-oriented RSP to avoid direct RP usage
    const headerAddr = (vm.rsp - RSTACK_BASE_CELLS) * CELL_SIZE;
    vm.rpush(header);
    dropList(vm);
    return headerAddr;
  }

  // Data stack is cell-indexed; compute first element cell (relative to STACK_BASE) and stream-copy to RSTACK via rpush
  let elementCell = vm.sp - STACK_BASE_CELLS - (slotCount + 1);
  for (let i = 0; i < slotCount; i++) {
    const value = vm.memory.readFloat32(SEG_DATA, STACK_BASE + elementCell * CELL_SIZE);
    vm.rpush(value);
    elementCell += 1;
  }
  // Compute header byte address from cell-oriented RSP (RP accessor removed)
  const headerAddr = (vm.rsp - RSTACK_BASE_CELLS) * CELL_SIZE;
  vm.rpush(header);
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
  const header = vm.memory.readFloat32(SEG_DATA, RSTACK_BASE + headerAddr);

  if (!isList(header)) {
    throw new Error('Expected LIST header at return stack address');
  }

  const slotCount = getListLength(header);

  if (slotCount === 0) {
    vm.push(header);
    return;
  }

  const headerCell = headerAddrToHeaderCell(headerAddr);
  const baseCell = computeBaseCellFromHeader(headerCell, slotCount);
  for (let i = 0; i < slotCount; i++) {
    const element = vm.memory.readFloat32(SEG_DATA, RSTACK_BASE + (baseCell + i) * CELL_SIZE);
    vm.push(element);
  }
  vm.push(header);
}

/**
 * Checks if a value is compound data that needs special transfer handling.
 */
// isList exported from core should be used for type checks

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
 * Mutates compound data in-place at a specific memory location.
 *
 * Key differences from transferCompoundToReturnStack:
 * - NO RSP advancement (overwrites existing space)
 * - Uses provided targetAddr instead of current RSP
 * - For variable mutation, not initialization
 *
 * @param vm The VM instance
 * @param targetAddr Byte address of existing compound data header
 * @param segment Memory segment (return stack for local variables)
 * @param newValue The new compound value from data stack (LIST header at TOS)
 */
// Note: legacy updateListInPlace(segment-based) removed; use updateListInPlaceAbs instead.

/**
 * Absolute-address variant of updateListInPlace for unified SEG_DATA writes.
 *
 * @param vm The VM instance
 * @param targetAbsHeaderAddr Absolute byte address of existing compound data header (SEG_DATA)
 */
export function updateListInPlaceAbs(vm: VM, targetAbsHeaderAddr: number): void {
  vm.ensureStackSize(1, 'updateListInPlace');
  const header = vm.peek();

  if (!isList(header)) {
    throw new Error('updateListInPlace expects list data');
  }

  validateListHeader(vm);
  const slotCount = getListLength(header);
  const existingHeader = vm.memory.readFloat32(SEG_DATA, targetAbsHeaderAddr);
  if (!isCompatible(existingHeader, header)) {
    throw new Error('Incompatible compound assignment: slot count or type mismatch');
  }

  if (slotCount === 0) {
    vm.memory.writeFloat32(SEG_DATA, targetAbsHeaderAddr, header);
    dropList(vm);
    return;
  }

  // Source cells from data stack (relative to STACK_BASE for reads below)
  let sourceCell = vm.sp - STACK_BASE_CELLS - (slotCount + 1);
  const targetHeaderCell = targetAbsHeaderAddr / CELL_SIZE;
  const targetBaseCell = computeBaseCellFromHeader(targetHeaderCell, slotCount);
  const targetBaseAbs = targetBaseCell * CELL_SIZE;

  for (let i = 0; i < slotCount; i++) {
    const value = vm.memory.readFloat32(SEG_DATA, STACK_BASE + sourceCell * CELL_SIZE);
    vm.memory.writeFloat32(SEG_DATA, targetBaseAbs + i * CELL_SIZE, value);
    sourceCell += 1;
  }
  vm.memory.writeFloat32(SEG_DATA, targetAbsHeaderAddr, header);
  dropList(vm);
}

/**
 * Backward-compat shim: segment-relative in-place mutation API.
 * Converts (segment, targetAddr) to absolute SEG_DATA address and forwards to updateListInPlaceAbs.
 *
 * This preserves existing test imports and older call sites during Phase C migrations.
 */
// Legacy segment-based API removed after tests migrated to Abs variant.

export { isList } from '@src/core';
