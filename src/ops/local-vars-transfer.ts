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
  SEG_RSTACK,
  SEG_STACK,
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
    const headerAddr = vm.RSP * CELL_SIZE;
    vm.rpush(header);
    dropList(vm);
    return headerAddr;
  }

  // Data stack is cell-indexed; compute first element cell and stream-copy to RSTACK via rpush
  let elementCell = vm.SP - (slotCount + 1);
  for (let i = 0; i < slotCount; i++) {
    const value = vm.memory.readFloat32(SEG_STACK, elementCell * CELL_SIZE);
    vm.rpush(value);
    elementCell += 1;
  }
  // Compute header byte address from cell-oriented RSP (RP accessor removed)
  const headerAddr = vm.RSP * CELL_SIZE;
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
  const header = vm.memory.readFloat32(SEG_RSTACK, headerAddr);

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
    const element = vm.memory.readFloat32(SEG_RSTACK, (baseCell + i) * CELL_SIZE);
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
 * @param segment Memory segment (SEG_RSTACK for local variables)
 * @param newValue The new compound value from data stack (LIST header at TOS)
 */
export function updateListInPlace(vm: VM, targetAddr: number, segment: number): void {
  vm.ensureStackSize(1, 'updateListInPlace');
  const header = vm.peek();

  if (!isList(header)) {
    throw new Error('updateListInPlace expects list data');
  }

  validateListHeader(vm);
  const slotCount = getListLength(header);
  const existingHeader = vm.memory.readFloat32(segment, targetAddr);
  if (!isCompatible(existingHeader, header)) {
    throw new Error('Incompatible compound assignment: slot count or type mismatch');
  }

  if (slotCount === 0) {
    vm.memory.writeFloat32(segment, targetAddr, header);
    dropList(vm);
    return;
  }
  let sourceCell = vm.SP - (slotCount + 1);
  const targetHeaderCell = headerAddrToHeaderCell(targetAddr);
  const targetBaseCell = computeBaseCellFromHeader(targetHeaderCell, slotCount);
  for (let i = 0; i < slotCount; i++) {
    const value = vm.memory.readFloat32(SEG_STACK, sourceCell * CELL_SIZE);
    vm.memory.writeFloat32(segment, (targetBaseCell + i) * CELL_SIZE, value);
    sourceCell += 1;
  }
  vm.memory.writeFloat32(segment, targetAddr, header);
  dropList(vm);
}

export { isList } from '@src/core';
