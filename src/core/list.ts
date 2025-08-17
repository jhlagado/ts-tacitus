/**
 * @file src/core/list.ts
 *
 * Core utilities for TACIT Reverse Lists (LIST).
 *
 * LISTs are stack-native compound data structures that store elements in
 * reverse order with the header at top-of-stack. This enables O(1) prepend
 * operations and O(1) skip/drop of entire structures while maintaining
 * contiguous memory layout for cache efficiency.
 *
 * Memory layout: [payload-s-1] ... [payload-1] [payload-0] [LIST:s] ← TOS
 */

import { VM } from './vm';
import { fromTaggedValue, isList } from './tagged';
import { SEG_STACK } from './constants';


/**
 * Extracts the slot count from an LIST header.
 *
 * @param header - Tagged LIST header value
 * @returns The number of slots in the LIST payload
 * @throws Error if the header is not a valid LIST tag
 */
export function getListSlotCount(header: number): number {
  if (!isList(header)) {
    throw new Error('Value is not an LIST header');
  }
  return fromTaggedValue(header).value;
}

/**
 * Skips (pops) an entire LIST from the stack in O(1) time.
 * Assumes the LIST header is at TOS.
 *
 * @param vm - The virtual machine instance
 */
export function skipList(vm: VM): void {
  validateListHeader(vm);

  const header = vm.peek();
  const slotCount = getListSlotCount(header);

  // Skip header + payload by popping all values
  for (let i = 0; i < slotCount + 1; i++) {
    vm.pop();
  }
}

/**
 * Returns the memory address of the first payload slot.
 * Assumes LIST header is at TOS.
 *
 * @param vm - The virtual machine instance
 * @returns Memory address of payload[0] (logical first element)
 */
export function getListPayloadStart(vm: VM): number {
  validateListHeader(vm);
  // Payload starts immediately below header at TOS
  // LIST layout: [payload...] [LIST:n] ← TOS (SP points after header)
  const header = vm.peek();
  const slotCount = getListSlotCount(header);
  if (slotCount === 0) {
    return vm.SP; // No payload for empty LIST
  }
  return vm.SP - 4; // First payload slot is one slot below header
}

/**
 * Validates that TOS contains a valid LIST header and stack has sufficient space.
 *
 * @param vm - The virtual machine instance
 * @throws Error if TOS is not valid LIST or stack constraints violated
 */
export function validateListHeader(vm: VM): void {
  vm.ensureStackSize(1, 'LIST header validation');

  const header = vm.peek();
  if (!isList(header)) {
    throw new Error('Expected LIST header at TOS');
  }

  const slotCount = getListSlotCount(header);
  vm.ensureStackSize(slotCount + 1, 'LIST payload validation');

  // Ensure slot count doesn't exceed 16-bit limit (65535)
  if (slotCount > 65535) {
    throw new Error(`LIST slot count ${slotCount} exceeds maximum of 65535`);
  }
}

/**
 * Traverses LIST to find the memory address of a logical element.
 * Accounts for compound values that span multiple slots.
 *
 * @param vm - The virtual machine instance
 * @param header - The LIST header value
 * @param headerAddr - Memory address where the LIST header is stored
 * @param logicalIndex - The logical index to find (0-based)
 * @returns Memory address of the element, or -1 if index out of bounds
 */
export function getListElementAddress(
  vm: VM,
  header: number,
  headerAddr: number,
  logicalIndex: number,
): number {
  if (!isList(header)) {
    throw new Error('Invalid LIST header provided to getListElementAddress');
  }

  const totalSlots = getListSlotCount(header);

  if (logicalIndex < 0) return -1;

  let currentAddr = headerAddr - 4; // Start at first payload slot (below header)
  let currentLogicalIndex = 0;
  let remainingSlots = totalSlots;

  while (remainingSlots > 0 && currentLogicalIndex <= logicalIndex) {
    // Read current value to determine if it's compound
    const currentValue = vm.memory.readFloat32(SEG_STACK, currentAddr);
    let stepSize = 1; // Default for atomic values
    let elementStartAddr = currentAddr; // Default for atomic values

    if (isList(currentValue)) {
      // This is an LIST header - element starts here
      elementStartAddr = currentAddr;
      stepSize = getListSlotCount(currentValue) + 1;
    }

    if (currentLogicalIndex === logicalIndex) {
      return elementStartAddr; // Found the target element
    }

    // Move to next element
    currentAddr -= stepSize * 4;
    remainingSlots -= stepSize;
    currentLogicalIndex++;
  }

  return -1; // Index out of bounds
}

/**
 * Reverses a span of values on the stack in-place.
 * Used during LIST construction to achieve reverse payload order.
 *
 * @param vm - The virtual machine instance
 * @param spanSize - Number of stack slots to reverse
 */
export function reverseSpan(vm: VM, spanSize: number): void {
  if (spanSize <= 1) return; // Nothing to reverse

  vm.ensureStackSize(spanSize, 'reverse span operation');

  const startAddr = vm.SP - spanSize * 4;
  const endAddr = vm.SP - 4;

  // In-place reversal using temporary storage
  for (let i = 0; i < Math.floor(spanSize / 2); i++) {
    const leftAddr = startAddr + i * 4;
    const rightAddr = endAddr - i * 4;

    const leftValue = vm.memory.readFloat32(SEG_STACK, leftAddr);
    const rightValue = vm.memory.readFloat32(SEG_STACK, rightAddr);

    vm.memory.writeFloat32(SEG_STACK, leftAddr, rightValue);
    vm.memory.writeFloat32(SEG_STACK, rightAddr, leftValue);
  }
}
