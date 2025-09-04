/**
 * @file src/ops/stack/data-move-ops.ts
 * Stack manipulation operations for the Tacit VM.
 */

import { VM } from '../../core/vm';
import { Verb } from '../../core/types';
import { fromTaggedValue, Tag } from '../../core/tagged';
import { SEG_STACK, CELL_SIZE } from '../../core/constants';
import { StackUnderflowError, VMError } from '../../core/errors';

/**
 * Stack argument info: [nextSlot, size].
 */
export type StackArgInfo = [number, number];

/**
 * Finds stack element from given slot.
 * @param vm VM instance
 * @param startSlot Slot offset from stack pointer
 * @returns [nextSlot, size] tuple
 */
export function findElement(vm: VM, startSlot = 0): [number, number] {
  const slotAddr = vm.SP / CELL_SIZE - startSlot - 1;

  if (slotAddr < 0 || slotAddr * CELL_SIZE >= vm.SP) {
    return [startSlot + 1, 1];
  }

  const addr = slotAddr * CELL_SIZE;
  const value = vm.memory.readFloat32(SEG_STACK, addr);
  const { tag, value: tagValue } = fromTaggedValue(value);

  if (tag === Tag.LIST) {
    const elementSize = tagValue + 1;
    return [startSlot + elementSize, elementSize];
  }

  return [startSlot + 1, 1];
}

/**
 * Copies stack elements to top.
 * @param vm VM instance
 * @param startSlot Starting slot index
 * @param slotCount Number of slots to copy
 */
export function cellsCopy(vm: VM, startSlot: number, slotCount: number): void {
  if (slotCount <= 0) return;

  const startAddr = startSlot * CELL_SIZE;
  let addr = startAddr;

  for (let i = 0; i < slotCount; i++) {
    const slot = vm.memory.readFloat32(SEG_STACK, addr);
    vm.push(slot);
    addr += CELL_SIZE;
  }
}

/**
 * Reverses a range of elements in the stack in-place.
 *
 * @param vm - The `VM` instance containing the stack.
 * @param startSlot - The starting slot index (0-based, relative to the stack top).
 * @param slotCount - The number of slots to reverse.
 */
export function cellsReverse(vm: VM, startSlot: number, slotCount: number): void {
  if (slotCount <= 1) return;

  const startAddr = startSlot * CELL_SIZE;
  const endAddr = startAddr + (slotCount - 1) * CELL_SIZE;

  let left = startAddr;
  let right = endAddr;

  while (left < right) {
    const temp = vm.memory.readFloat32(SEG_STACK, left);
    const rightVal = vm.memory.readFloat32(SEG_STACK, right);

    vm.memory.writeFloat32(SEG_STACK, left, rightVal);
    vm.memory.writeFloat32(SEG_STACK, right, temp);

    left += CELL_SIZE;
    right -= CELL_SIZE;
  }
}

/**
 * Rotates a range of elements in the stack by a specified number of positions.
 *
 * @param vm - The `VM` instance containing the stack.
 * @param startSlot - The starting slot index (0-based, relative to the stack top).
 * @param rangeSize - The number of slots in the range to rotate.
 * @param shiftSlots - The number of positions to rotate (positive for right rotation, negative for left).
 */
export function cellsRoll(vm: VM, startSlot: number, rangeSize: number, shiftSlots: number): void {
  if (rangeSize <= 1) return;

  const normalizedShift = ((shiftSlots % rangeSize) + rangeSize) % rangeSize;
  if (normalizedShift === 0) return;

  const splitPoint = rangeSize - normalizedShift;
  cellsReverse(vm, startSlot, splitPoint);
  cellsReverse(vm, startSlot + splitPoint, normalizedShift);
  cellsReverse(vm, startSlot, rangeSize);
}

/** Stack operation utilities. */

/**
 * Internal utility: Finds an element at a specific logical index in the stack.
 *
 * This function traverses the stack element-by-element (respecting LIST boundaries)
 * to find the element at the given logical index. Used internally by operations
 * like `pick` that need to access elements by their logical position.
 *
 * @param vm - The VM instance
 * @param index - The logical element index (0 = TOS)
 * @returns A tuple `[targetSlot, size]` for the element at the given index
 */
function findElementAtIndex(vm: VM, index: number): [number, number] {
  let currentSlot = 0;

  for (let i = 0; i <= index; i++) {
    if (currentSlot * CELL_SIZE >= vm.SP) {
      throw new StackUnderflowError('pick', index + 1, vm.getStackData());
    }

    const [nextSlot, size] = findElement(vm, currentSlot);

    if (i === index) {
      const targetSlot = vm.SP / CELL_SIZE - nextSlot;
      return [targetSlot, size];
    }

    currentSlot = nextSlot;
  }

  throw new VMError(`Failed to find element at index ${index}`, vm.getStackData());
}

/**
 * Validates that the stack has at least the specified number of elements.
 */
function validateStackDepth(vm: VM, requiredElements: number, operationName: string): void {
  vm.ensureStackSize(requiredElements, operationName);
}

/**
 * Safely executes a stack operation with error handling and stack pointer restoration.
 */
function safeStackOperation(vm: VM, operation: () => void, operationName: string): void {
  const originalSP = vm.SP;

  try {
    operation();
  } catch (error) {
    vm.SP = originalSP;
    if (error instanceof VMError) {
      throw error;
    } else {
      throw new VMError(
        `${operationName} failed: ${error instanceof Error ? error.message : String(error)}`,
        vm.getStackData(),
      );
    }
  }
}

/** Stack operations. */

/**
 * Implements the dup (duplicate) operation.
 * Stack effect: ( a — a a )
 * Duplicates the top element of the stack, handling both simple values and complex data structures.
 */
export const dupOp: Verb = (vm: VM) => {
  validateStackDepth(vm, 1, 'dup');

  const [tosStartSlot, tosSize] = findElementAtIndex(vm, 0);
  cellsCopy(vm, tosStartSlot, tosSize);
};

/**
 * Implements the over operation.
 * Stack effect: ( a b — a b a )
 * Copies the second element on the stack to the top, preserving the original.
 */
export const overOp: Verb = (vm: VM) => {
  validateStackDepth(vm, 2, 'over');

  const originalSP = vm.SP;

  try {
    const [_topNextSlot, topSlots] = findElement(vm, 0);
    const [_secondNextSlot, secondSlots] = findElement(vm, topSlots);

    const secondAddr = vm.SP - (topSlots + secondSlots) * CELL_SIZE;

    for (let i = 0; i < secondSlots; i++) {
      const value = vm.memory.readFloat32(SEG_STACK, secondAddr + i * CELL_SIZE);
      vm.push(value);
    }
  } catch (error) {
    vm.SP = originalSP;
    throw new Error(`over failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Implements the pick operation.
 * Stack effect: ( ... n — ... copy_of_nth )
 * Copies an element from a specific depth in the stack to the top.
 */
export const pickOp: Verb = (vm: VM) => {
  validateStackDepth(vm, 1, 'pick');

  const index = vm.pop();

  if (index < 0) {
    throw new Error(`Invalid index for pick: ${index}`);
  }

  try {
    const [targetSlot, targetSize] = findElementAtIndex(vm, index);
    cellsCopy(vm, targetSlot, targetSize);
  } catch {
    throw new Error(`Stack underflow in pick operation`);
  }
};

/**
 * Implements the drop operation.
 * Stack effect: ( a — )
 * Removes the top element from the stack. If the top element is a list, removes the entire list structure.
 */
export const dropOp: Verb = (vm: VM) => {
  validateStackDepth(vm, 1, 'drop');
  const topValue = vm.peek();
  const { tag, value } = fromTaggedValue(topValue);
  if (tag === Tag.LIST) {
    const totalSlots = value + 1;
    vm.SP -= totalSlots * CELL_SIZE;
    return;
  }
  vm.pop();
};

/**
 * Implements the swap operation.
 * Stack effect: ( a b — b a )
 * Exchanges the top two elements on the stack.
 */
export const swapOp: Verb = (vm: VM) => {
  validateStackDepth(vm, 2, 'swap');

  const originalSP = vm.SP;

  try {
    const [_topNextSlot, topSlots] = findElement(vm, 0);
    const [_secondNextSlot, secondSlots] = findElement(vm, topSlots);

    const totalSlots = topSlots + secondSlots;
    const stackLength = vm.SP / CELL_SIZE;
    const startSlot = stackLength - totalSlots;

    cellsRoll(vm, startSlot, totalSlots, topSlots);
  } catch (error) {
    vm.SP = originalSP;
    if (error instanceof VMError) {
      throw error;
    } else {
      throw new VMError(
        `swap failed: ${error instanceof Error ? error.message : String(error)}`,
        vm.getStackData(),
      );
    }
  }
};

/**
 * Implements the rot (rotate) operation.
 * Stack effect: ( a b c — b c a )
 * Rotates the top three elements on the stack, moving the third element to the top.
 */
export const rotOp: Verb = (vm: VM) => {
  validateStackDepth(vm, 3, 'rot');

  const originalSP = vm.SP;

  try {
    const [_topNextSlot, topSlots] = findElement(vm, 0);
    const [_midNextSlot, midSlots] = findElement(vm, topSlots);
    const [_bottomNextSlot, bottomSlots] = findElement(vm, topSlots + midSlots);

    const totalSlots = topSlots + midSlots + bottomSlots;
    const rotationSlots = midSlots + topSlots;

    cellsRoll(vm, 0, totalSlots, rotationSlots);
  } catch (error) {
    vm.SP = originalSP;
    if (error instanceof VMError) {
      throw error;
    } else {
      throw new VMError(
        `rot failed: ${error instanceof Error ? error.message : String(error)}`,
        vm.getStackData(),
      );
    }
  }
};

/**
 * Implements the revrot (reverse rotate) operation.
 * Stack effect: ( a b c — c a b )
 * Performs a reverse rotation of the top three elements on the stack.
 */
export const revrotOp: Verb = (vm: VM) => {
  validateStackDepth(vm, 3, 'revrot');

  const originalSP = vm.SP;

  try {
    const [_topNextSlot, topSlots] = findElement(vm, 0);
    const [_midNextSlot, midSlots] = findElement(vm, topSlots);
    const [_bottomNextSlot, bottomSlots] = findElement(vm, topSlots + midSlots);

    const totalSlots = topSlots + midSlots + bottomSlots;

    cellsRoll(vm, 0, totalSlots, topSlots);
  } catch (error) {
    vm.SP = originalSP;
    if (error instanceof VMError) {
      throw error;
    } else {
      throw new VMError(
        `revrot failed: ${error instanceof Error ? error.message : String(error)}`,
        vm.getStackData(),
      );
    }
  }
};

/**
 * Implements the nip operation.
 * Stack effect: ( a b — b )
 * Removes the second element from the top of the stack (NOS - Next On Stack).
 */
export const nipOp: Verb = (vm: VM) => {
  validateStackDepth(vm, 2, 'nip');

  safeStackOperation(
    vm,
    () => {
      const [_tosNextSlot, tosSize] = findElement(vm, 0);
      const [_nosNextSlot, nosSize] = findElement(vm, tosSize);

      const tosStartAddr = vm.SP - tosSize * CELL_SIZE;
      const nosStartAddr = vm.SP - (tosSize + nosSize) * CELL_SIZE;

      for (let i = 0; i < tosSize; i++) {
        const sourceAddr = tosStartAddr + i * CELL_SIZE;
        const destAddr = nosStartAddr + i * CELL_SIZE;

        const value = vm.memory.readFloat32(SEG_STACK, sourceAddr);
        vm.memory.writeFloat32(SEG_STACK, destAddr, value);
      }

      vm.SP -= nosSize * CELL_SIZE;
    },
    'nip',
  );
};

/**
 * Implements the tuck operation.
 * Stack effect: ( a b — b a b )
 * Duplicates the top element and inserts the copy under the second element.
 */
export const tuckOp: Verb = (vm: VM) => {
  validateStackDepth(vm, 2, 'tuck');

  safeStackOperation(
    vm,
    () => {
      swapOp(vm);
      overOp(vm);
    },
    'tuck',
  );
};
