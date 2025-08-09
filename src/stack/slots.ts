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

import { VM } from '../core/vm';
import { SEG_STACK } from '../core/constants';
import { BYTES_PER_ELEMENT } from '../core/constants';

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
 *
 * slotsCopy(vm, 0, 2);
 *
 *
 * @example
 *
 * slotsCopy(vm, 1, 1);
 *
 */

export function slotsCopy(vm: VM, startSlot: number, slotCount: number): void {
  if (slotCount <= 0) return;

  const startAddr = startSlot * BYTES_PER_ELEMENT;
  let addr = startAddr;

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
 *
 * slotsReverse(vm, 0, 4);
 *
 *
 * @example
 *
 * slotsReverse(vm, 1, 3);
 *
 */

export function slotsReverse(vm: VM, startSlot: number, slotCount: number): void {
  if (slotCount <= 1) return;

  const startAddr = startSlot * BYTES_PER_ELEMENT;
  const endAddr = startAddr + (slotCount - 1) * BYTES_PER_ELEMENT;

  let left = startAddr;
  let right = endAddr;

  while (left < right) {
    const temp = vm.memory.readFloat32(SEG_STACK, left);
    const rightVal = vm.memory.readFloat32(SEG_STACK, right);

    vm.memory.writeFloat32(SEG_STACK, left, rightVal);
    vm.memory.writeFloat32(SEG_STACK, right, temp);

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
 *
 *
 * slotsRoll(vm, 0, 5, 2);
 *
 *
 * @example
 *
 *
 * slotsRoll(vm, 1, 3, 1);
 *
 */

export function slotsRoll(vm: VM, startSlot: number, rangeSize: number, shiftSlots: number): void {
  if (rangeSize <= 1) return;

  const normalizedShift = ((shiftSlots % rangeSize) + rangeSize) % rangeSize;

  if (normalizedShift === 0) return;

  const splitPoint = rangeSize - normalizedShift;
  slotsReverse(vm, startSlot, splitPoint);

  slotsReverse(vm, startSlot + splitPoint, normalizedShift);

  slotsReverse(vm, startSlot, rangeSize);
}
