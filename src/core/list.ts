/**
 * @file src/core/list.ts
 * Core utilities for Tacit Reverse Lists.
 */

import { VM } from './vm';
import { fromTaggedValue, Tag, getTag } from './tagged';
import { SEG_DATA, CELL_SIZE } from './constants';
import { isRef, getByteAddressFromRef } from './refs';

/**
 * Checks if a value is a LIST.
 * @param tval The value to check
 * @returns true if the value is a LIST
 */
export function isList(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.LIST;
}

/**
 * Extracts slot count from LIST header.
 * @param header Tagged LIST header value
 * @returns Number of slots in payload
 * @throws Error if header is not valid LIST
 */
export function getListLength(header: number): number {
  if (!isList(header)) {
    throw new Error('Value is not an LIST header');
  }
  return fromTaggedValue(header).value;
}

/**
 * Drops entire LIST from stack.
 * @param vm The virtual machine instance
 */
export function dropList(vm: VM): void {
  validateListHeader(vm);

  const header = vm.peek();
  const slotCount = getListLength(header);

  for (let i = 0; i < slotCount + 1; i++) {
    vm.pop();
  }
}

/**
 * Validates LIST header at TOS.
 * @param vm The virtual machine instance
 * @throws Error if TOS is not valid LIST
 */
export function validateListHeader(vm: VM): void {
  vm.ensureStackSize(1, 'LIST header validation');

  const header = vm.peek();
  if (!isList(header)) {
    throw new Error('Expected LIST header at TOS');
  }

  const slotCount = getListLength(header);
  vm.ensureStackSize(slotCount + 1, 'LIST payload validation');
}

/**
 * Finds memory address of logical element in LIST.
 * @param vm The virtual machine instance
 * @param header The LIST header value
 * @param headerAddr Memory address of LIST header
 * @param logicalIndex The logical index (0-based)
 * @returns Memory address or -1 if out of bounds
 */
export function getListElemAddr(
  vm: VM,
  header: number,
  headerAbsAddr: number,
  logicalIndex: number,
): number {
  if (!isList(header)) {
    throw new Error('Invalid LIST header provided to getListElemAddr');
  }

  const totalSlots = getListLength(header);
  if (logicalIndex < 0) return -1;

  let currentAddr = headerAbsAddr - CELL_SIZE;
  let currentLogicalIndex = 0;
  let remainingSlots = totalSlots;

  while (remainingSlots > 0 && currentLogicalIndex <= logicalIndex) {
    const currentValue = vm.memory.readFloat32(SEG_DATA, currentAddr);
    let stepSize = 1;
    let elementStartAddr = currentAddr;

    if (isList(currentValue)) {
      stepSize = getListLength(currentValue) + 1;
    }

    if (currentLogicalIndex === logicalIndex) {
      return elementStartAddr;
    }

    currentAddr -= stepSize * CELL_SIZE;
    remainingSlots -= stepSize;
    currentLogicalIndex++;
  }

  return -1;
}

/**
 * Reverses span of values on stack in-place.
 * @param vm The virtual machine instance
 * @param spanSize Number of stack slots to reverse
 */
export function reverseSpan(vm: VM, spanSize: number): void {
  if (spanSize <= 1) return;

  vm.ensureStackSize(spanSize, 'reverse span operation');
  // Reverse using absolute cell indices via u32 view
  const endCellExclusive = vm.sp;
  const startCellAbs = endCellExclusive - spanSize;
  let i = 0;
  let j = spanSize - 1;
  while (i < j) {
    const leftIdx = startCellAbs + i;
    const rightIdx = startCellAbs + j;
    const left = vm.memory.u32[leftIdx];
    const right = vm.memory.u32[rightIdx];
    vm.memory.u32[leftIdx] = right;
    vm.memory.u32[rightIdx] = left;
    i++;
    j--;
  }
}

/**
 * Extract list header and base address from a direct LIST or a reference.
 * Returns null if value is neither a list nor a ref-to-list.
 */
export function getListBounds(
  vm: VM,
  value: number,
): { header: number; baseAddrBytes: number; headerAddrBytes: number } | null {
  const tag = getTag(value);
  if (tag === Tag.LIST) {
    const slotCount = getListLength(value);
    const headerCellAbs = vm.sp - 1;
    const baseCellAbs = headerCellAbs - slotCount;
    const headerAddrBytes = headerCellAbs * CELL_SIZE;
    const baseAddrBytes = baseCellAbs * CELL_SIZE;
    return { header: value, baseAddrBytes, headerAddrBytes };
  } else if (isRef(value)) {
    // Absolute dereferencing (support ref-to-ref indirection)
    let headerAddr = getByteAddressFromRef(value);
    let header = vm.memory.readFloat32(SEG_DATA, headerAddr);
    if (isRef(header)) {
      headerAddr = getByteAddressFromRef(header);
      header = vm.memory.readFloat32(SEG_DATA, headerAddr);
    }

    if (!isList(header)) {
      return null;
    }
    const slotCount = getListLength(header);
    const baseAddrBytes = headerAddr - slotCount * CELL_SIZE;
    return { header, baseAddrBytes, headerAddrBytes: headerAddr };
  }
  return null;
}

/**
 * Computes header address given base address and slot count.
 */
// deprecated segment-relative computeHeaderAddr wrapper removed; use computeHeaderAddr

export function computeHeaderAddr(baseAddrBytes: number, slotCount: number): number {
  return baseAddrBytes + slotCount * CELL_SIZE;
}

// Style aliases (Phase 1):
// old alias exports removed
