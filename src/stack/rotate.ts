import { VM } from '../core/vm';
import { SEG_STACK } from '../core/memory';

/**
 * Reverses a range of elements in the stack.
 * @param vm - The VM instance
 * @param startAddr - The starting address of the range to reverse (in bytes)
 * @param slotCount - The number of slots to reverse
 */
export function reverseRange(vm: VM, startAddr: number, slotCount: number): void {
  if (slotCount <= 1) return;

  const endAddr = startAddr + (slotCount - 1) * 4;
  let left = startAddr;
  let right = endAddr;

  while (left < right) {
    const temp = vm.memory.readFloat32(SEG_STACK, left);
    vm.memory.writeFloat32(SEG_STACK, left, vm.memory.readFloat32(SEG_STACK, right));
    vm.memory.writeFloat32(SEG_STACK, right, temp);

    left += 4;
    right -= 4;
  }
}

/**
 * Rotates a range of elements in the stack by a specified number of positions.
 * @param vm - The VM instance
 * @param startSlot - The starting slot index (0-based) of the range to rotate
 * @param rangeSize - The number of slots in the range
 * @param shiftSlots - The number of positions to rotate (positive for right, negative for left)
 */
/**
 * Rotates a range of elements in the stack by a specified number of positions.
 * @param vm - The VM instance
 * @param startSlot - The starting slot index (0-based) of the range to rotate
 * @param rangeSize - The number of slots in the range
 * @param shiftSlots - The number of positions to rotate (positive for right, negative for left)
 */
export function rangeRoll(vm: VM, startSlot: number, rangeSize: number, shiftSlots: number): void {
  if (rangeSize <= 1) return;

  const startAddr = startSlot * 4;

  const normalizedShift = ((shiftSlots % rangeSize) + rangeSize) % rangeSize;
  if (normalizedShift === 0) return;

  const splitPoint = rangeSize - normalizedShift;

  reverseRange(vm, startAddr, splitPoint);

  reverseRange(vm, startAddr + splitPoint * 4, normalizedShift);

  reverseRange(vm, startAddr, rangeSize);
}
