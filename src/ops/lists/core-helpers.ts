/**
 * @file src/ops/lists/core-helpers.ts
 * Shared, segment-aware helpers for list operations.
 */

import { VM, getTag, Tag, SEG_STACK, CELL_SIZE, isRef, resolveReference } from '@src/core';
import { getListLength, isList } from '@src/core';

/**
 * Extract list header and base address from a direct LIST or a reference.
 * Returns null if value is neither a list nor a ref-to-list.
 */
export function getListHeaderAndBase(
  vm: VM,
  value: number,
): { header: number; baseAddr: number; segment: number } | null {
  const tag = getTag(value);
  if (tag === Tag.LIST) {
    const slotCount = getListLength(value);
    return { header: value, baseAddr: vm.SP - CELL_SIZE - slotCount * CELL_SIZE, segment: SEG_STACK };
  } else if (isRef(value)) {
    const { address, segment } = resolveReference(vm, value);
    const header = vm.memory.readFloat32(segment, address);
    if (!isList(header)) {
      return null;
    }
    const slotCount = getListLength(header);
    return { header, baseAddr: address - slotCount * CELL_SIZE, segment };
  }
  return null;
}

/**
 * Computes header address given base address and slot count.
 */
export function computeHeaderAddr(baseAddr: number, slotCount: number): number {
  return baseAddr + slotCount * CELL_SIZE;
}
