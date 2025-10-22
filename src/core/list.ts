/**
 * @file src/core/list.ts
 * Core utilities for Tacit Reverse Lists.
 */

import { VM } from './vm';
import { fromTaggedValue, Tag, getTag } from './tagged';
import { SEG_STACK, SEG_GLOBAL, SEG_RSTACK, SEG_DATA, CELL_SIZE, STACK_BASE, GLOBAL_BASE, RSTACK_BASE } from './constants';
import { isRef, resolveReference } from './refs';

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
  headerAddr: number,
  logicalIndex: number,
  segment: number = SEG_STACK,
): number {
  if (!isList(header)) {
    throw new Error('Invalid LIST header provided to getListElemAddr');
  }

  const totalSlots = getListLength(header);

  if (logicalIndex < 0) return -1;

  let currentAddr = headerAddr - 4;
  let currentLogicalIndex = 0;
  let remainingSlots = totalSlots;

  const base = segment === SEG_STACK
    ? STACK_BASE
    : segment === SEG_GLOBAL
    ? GLOBAL_BASE
    : segment === SEG_RSTACK
    ? RSTACK_BASE
    : 0;

  while (remainingSlots > 0 && currentLogicalIndex <= logicalIndex) {
    const currentValue = vm.memory.readFloat32(SEG_DATA, base + currentAddr);
    let stepSize = 1;
    let elementStartAddr = currentAddr;

    if (isList(currentValue)) {
      elementStartAddr = currentAddr;
      stepSize = getListLength(currentValue) + 1;
    }

    if (currentLogicalIndex === logicalIndex) {
      return elementStartAddr;
    }

    currentAddr -= stepSize * 4;
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
  // Reverse using cell-native indices via u32 view
  const endCellExclusive = vm.SP;
  const startCell = endCellExclusive - spanSize;
  let i = 0;
  let j = spanSize - 1;
  const baseCell = vm.memory.resolveAddress(SEG_DATA, STACK_BASE) >> 2;
  while (i < j) {
    const leftIdx = baseCell + startCell + i;
    const rightIdx = baseCell + startCell + j;
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
): { header: number; baseAddr: number; segment: number } | null {
  const tag = getTag(value);
  if (tag === Tag.LIST) {
    const slotCount = getListLength(value);
    return {
      header: value,
      baseAddr: (vm.SP - 1 - slotCount) * CELL_SIZE,
      segment: SEG_STACK,
    };
  } else if (isRef(value)) {
    const first = resolveReference(vm, value);
    let addr = first.address;
    let seg = first.segment;
    const baseForSeg = seg === SEG_STACK ? STACK_BASE : seg === SEG_GLOBAL ? GLOBAL_BASE : RSTACK_BASE;
    let header = vm.memory.readFloat32(SEG_DATA, baseForSeg + addr);

    // Support ref-to-ref indirection: dereference one additional level if needed.
    if (isRef(header)) {
      const inner = resolveReference(vm, header);
      seg = inner.segment;
      addr = inner.address;
      const innerBase = seg === SEG_STACK ? STACK_BASE : seg === SEG_GLOBAL ? GLOBAL_BASE : RSTACK_BASE;
      header = vm.memory.readFloat32(SEG_DATA, innerBase + addr);
    }

    if (!isList(header)) {
      return null;
    }
    const slotCount = getListLength(header);
    return { header, baseAddr: addr - slotCount * CELL_SIZE, segment: seg };
  }
  return null;
}

/**
 * Computes header address given base address and slot count.
 */
export function computeHeaderAddr(baseAddr: number, slotCount: number): number {
  return baseAddr + slotCount * CELL_SIZE;
}

// Style aliases (Phase 1):
// old alias exports removed
