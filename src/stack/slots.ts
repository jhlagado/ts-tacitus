import { VM } from '../core/vm';
import { SEG_STACK } from '../core/memory';
import { BYTES_PER_ELEMENT } from '../core/constants';

/**
 * Copies a range of elements in the stack.
 * @param vm - The VM instance
 * @param startSlot - The starting slot index (0-based) of the range to rotate
 * @param slotCount - The number of slots to reverse
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
 * Reverses a range of elements in the stack.
 * @param vm - The VM instance
 * @param startSlot - The starting slot index (0-based) of the range to rotate
 * @param slotCount - The number of slots to reverse
 */
export function slotsReverse(vm: VM, startSlot: number, slotCount: number): void {
  if (slotCount <= 1) return;

  const startAddr = startSlot * BYTES_PER_ELEMENT;
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
export function slotsRoll(vm: VM, startSlot: number, rangeSize: number, shiftSlots: number): void {
  if (rangeSize <= 1) return;

  const normalizedShift = ((shiftSlots % rangeSize) + rangeSize) % rangeSize;
  if (normalizedShift === 0) return;

  const splitPoint = rangeSize - normalizedShift;

  slotsReverse(vm, startSlot, splitPoint);

  slotsReverse(vm, startSlot + splitPoint, normalizedShift);

  slotsReverse(vm, startSlot, rangeSize);
}
