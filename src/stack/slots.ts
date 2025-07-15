/**
 * @file src/stack/slots.ts
 * 
 * This file implements low-level stack slot manipulation operations for the Tacit VM.
 * 
 * The stack in Tacit is organized into slots, each containing a tagged value.
 * This module provides utilities for manipulating ranges of slots, including:
 * - Copying slots from one location to another
 * - Reversing the order of slots in a range
 * - Rotating slots within a range
 * 
 * These operations are fundamental building blocks for higher-level stack
 * manipulation operations like dup, swap, rot, etc.
 */

import { VM } from '../core/vm'; // VM class for stack operations
import { Memory } from '../core/memory';
import { SEG_STACK, STACK_SIZE } from '../core/constants'; // Memory segment for the stack
import { BYTES_PER_ELEMENT } from '../core/constants'; // Constant for the size of each stack element in bytes

/**
 * Copies a range of elements in the stack to the top of the stack.
 * 
 * This function reads a specified number of slots starting from a given position
 * and pushes copies of those values onto the top of the stack. The original
 * values remain unchanged.
 * 
 * @param vm - The `VM` instance containing the stack.
 * @param startSlot - The starting slot index (0-based, relative to the stack top).
 * @param slotCount - The number of slots to copy.
 * 
 * @example
 * // Stack before: [... 10 20 30]
 * slotsCopy(vm, 0, 2);
 * // Stack after: [... 10 20 30 30 20]
 * 
 * @example
 * // Stack before: [... 5 10 15]
 * slotsCopy(vm, 1, 1);
 * // Stack after: [... 5 10 15 10]
 */

export function slotsCopy(vm: VM, startSlot: number, slotCount: number): void {
  if (slotCount <= 0) return; // No operation needed if slotCount is zero or negative

  // Calculate the starting byte address for copying, relative to the stack base.
  const startAddr = startSlot * BYTES_PER_ELEMENT;
  let addr = startAddr;

  // Iterate through the specified number of slots, reading each value and pushing a copy to the top of the stack.
  for (let i = 0; i < slotCount; i++) {
    const slot = vm.memory.readFloat32(SEG_STACK, addr);
    vm.push(slot);
    addr += BYTES_PER_ELEMENT;
  }
}

/**
 * Reverses a range of elements in the stack in-place.
 * 
 * This function reverses the order of a specified number of slots starting
 * from a given position. The operation is performed in-place, modifying
 * the original stack contents.
 * 
 * @param vm - The `VM` instance containing the stack.
 * @param startSlot - The starting slot index (0-based, relative to the stack top).
 * @param slotCount - The number of slots to reverse.
 * 
 * @example
 * // Stack before: [... 10 20 30 40]
 * slotsReverse(vm, 0, 4);
 * // Stack after: [... 40 30 20 10]
 * 
 * @example
 * // Stack before: [... 5 10 15 20 25]
 * slotsReverse(vm, 1, 3);
 * // Stack after: [... 5 20 15 10 25]
 */

export function slotsReverse(vm: VM, startSlot: number, slotCount: number): void {
  if (slotCount <= 1) return; // No reversal needed for 0 or 1 elements

  // Calculate the byte addresses for the start and end of the range to be reversed.
  const startAddr = startSlot * BYTES_PER_ELEMENT;
  const endAddr = startAddr + (slotCount - 1) * BYTES_PER_ELEMENT;

  // Initialize left and right pointers for in-place swapping.
  let left = startAddr;
  let right = endAddr;

  // Perform swaps until the pointers meet or cross.
  while (left < right) {
    // Read values from both ends of the range.
    const temp = vm.memory.readFloat32(SEG_STACK, left);
    const rightVal = vm.memory.readFloat32(SEG_STACK, right);

    // Swap the values by writing them back to their new positions.
    vm.memory.writeFloat32(SEG_STACK, left, rightVal);
    vm.memory.writeFloat32(SEG_STACK, right, temp);

    // Move pointers towards the center.
    left += BYTES_PER_ELEMENT;
    right -= BYTES_PER_ELEMENT;
  }
}

/**
 * Rotates a range of elements in the stack by a specified number of positions.
 * 
 * This function rotates a specified range of slots by shifting them a given
 * number of positions. The rotation is performed in-place using a three-step
 * reversal algorithm:
 * 1. Reverse the first part of the range
 * 2. Reverse the second part of the range
 * 3. Reverse the entire range
 * 
 * @param vm - The `VM` instance containing the stack.
 * @param startSlot - The starting slot index (0-based, relative to the stack top).
 * @param rangeSize - The number of slots in the range to rotate.
 * @param shiftSlots - The number of positions to rotate (positive for right rotation, negative for left).
 * 
 * @example
 * // Stack before: [... 10 20 30 40 50]
 * // Rotate the entire stack right by 2 positions
 * slotsRoll(vm, 0, 5, 2);
 * // Stack after: [... 40 50 10 20 30]
 * 
 * @example
 * // Stack before: [... 10 20 30 40 50]
 * // Rotate the middle 3 elements right by 1 position
 * slotsRoll(vm, 1, 3, 1);
 * // Stack after: [... 10 40 20 30 50]
 */

export function slotsRoll(vm: VM, startSlot: number, rangeSize: number, shiftSlots: number): void {
  if (rangeSize <= 1) return; // No rotation needed for 0 or 1 elements

  // Normalize the shift amount to be within the range [0, rangeSize - 1].
  // This handles negative shifts (converting them to equivalent positive shifts)
  // and shifts larger than the rangeSize.
  const normalizedShift = ((shiftSlots % rangeSize) + rangeSize) % rangeSize;

  if (normalizedShift === 0) return; // No rotation needed if shift is 0 after normalization

  // The rotation is performed using a three-step reversal algorithm:
  // 1. Reverse the first part of the range (elements that will move to the end).
  const splitPoint = rangeSize - normalizedShift;
  slotsReverse(vm, startSlot, splitPoint);

  // 2. Reverse the second part of the range (elements that will move to the beginning).
  slotsReverse(vm, startSlot + splitPoint, normalizedShift);

  // 3. Reverse the entire range to put all elements in their final rotated positions.
  slotsReverse(vm, startSlot, rangeSize);
}
