/**
 * @file src/core/list.ts
 * Core utilities for Tacit Reverse Lists.
 */

import type { VM } from './vm';
import { peek, pop, ensureStackSize } from './vm';
import { fromTaggedValue, Tag, getTag } from './tagged';
import { SEG_DATA, CELL_SIZE } from './constants';
import { isRef, getCellFromRef } from './refs';

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
    throw new Error('Expected LIST header');
  }
  return fromTaggedValue(header).value;
}

/**
 * Drops entire LIST from stack.
 * @param vm The virtual machine instance
 */
export function dropList(vm: VM): void {
  validateListHeader(vm);

  const header = peek(vm);
  const slotCount = getListLength(header);

  for (let i = 0; i < slotCount + 1; i++) {
    pop(vm);
  }
}

/**
 * Validates LIST header at TOS.
 * @param vm The virtual machine instance
 * @throws Error if TOS is not valid LIST
 */
export function validateListHeader(vm: VM): void {
  ensureStackSize(vm, 1, 'LIST header validation');

  const header = peek(vm);
  if (!isList(header)) {
    throw new Error('Expected LIST header at TOS');
  }

  const slotCount = getListLength(header);
  ensureStackSize(vm, slotCount + 1, 'LIST payload validation');
}

/**
 * Finds cell index of logical element in LIST.
 * @param vm The virtual machine instance
 * @param header The LIST header value
 * @param headerCell Cell index of LIST header
 * @param logicalIndex The logical index (0-based)
 * @returns Cell index or -1 if out of bounds
 */
export function getListElemCell(
  vm: VM,
  header: number,
  headerCell: number,
  logicalIndex: number,
): number {
  if (!isList(header)) {
    throw new Error('Expected LIST header');
  }

  const totalSlots = getListLength(header);
  if (logicalIndex < 0) {
    return -1;
  }

  let currentCell = headerCell - 1;
  let currentLogicalIndex = 0;
  let remainingSlots = totalSlots;

  while (remainingSlots > 0 && currentLogicalIndex <= logicalIndex) {
    const currentValue = vm.memory.readCell(currentCell);
    let stepSize = 1;

    if (isList(currentValue)) {
      stepSize = getListLength(currentValue) + 1;
    }

    if (currentLogicalIndex === logicalIndex) {
      return currentCell;
    }

    currentCell -= stepSize;
    remainingSlots -= stepSize;
    currentLogicalIndex++;
  }

  return -1;
}

/** @deprecated Use getListElemCell instead */
export function getListElemAddr(
  vm: VM,
  header: number,
  headerAbsAddr: number,
  logicalIndex: number,
): number {
  const cell = getListElemCell(vm, header, headerAbsAddr / CELL_SIZE, logicalIndex);
  return cell === -1 ? -1 : cell * CELL_SIZE;
}

/**
 * Reverses span of values on stack in-place.
 * @param vm The virtual machine instance
 * @param spanSize Number of stack slots to reverse
 */
export function reverseSpan(vm: VM, spanSize: number): void {
  if (spanSize <= 1) {
return;
}

  ensureStackSize(vm, spanSize, 'reverse span operation');
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
): { header: number; baseCell: number; headerCell: number } | null {
  const tag = getTag(value);
  if (tag === Tag.LIST) {
    const n = getListLength(value);
    const hdr = vm.sp - 1;
    const base = hdr - n;
    return { header: value, baseCell: base, headerCell: hdr };
  } else if (isRef(value)) {
    let hdr = getCellFromRef(value);
    let header = vm.memory.readCell(hdr);
    if (isRef(header)) {
      hdr = getCellFromRef(header);
      header = vm.memory.readCell(hdr);
    }

    if (!isList(header)) {
      return null;
    }
    const n = getListLength(header);
    const base = hdr - n;
    return { header, baseCell: base, headerCell: hdr };
  }
  return null;
}

/**
 * Computes header cell index given base cell index and slot count.
 */
export function computeHeaderCell(baseCell: number, slotCount: number): number {
  return baseCell + slotCount;
}

/**
 * Copies list payload slots from source to destination.
 * @param vm - VM instance
 * @param srcBaseCell - Source absolute cell index (first payload slot)
 * @param destBaseCell - Destination absolute cell index (first payload slot)
 * @param slots - Number of slots to copy
 */
export function copyListPayload(vm: VM, srcBaseCell: number, destBaseCell: number, slots: number): void {
  for (let i = 0; i < slots; i++) {
    const val = vm.memory.readCell(srcBaseCell + i);
    vm.memory.writeCell(destBaseCell + i, val);
  }
}

/**
 * Gets list bounds or throws if value is not a list.
 * @param vm - VM instance
 * @param value - Value to check
 * @returns List bounds info
 * @throws {Error} If value is not a list
 */
export function getListInfoOrFail(
  vm: VM,
  value: number,
): { header: number; baseCell: number; headerCell: number } {
  const info = getListBounds(vm, value);
  if (!info || !isList(info.header)) {
    throw new Error('Expected LIST');
  }
  return info;
}

