/**
 * @file src/core/stack-ops.ts
 * Stack manipulation operations for the Tacit VM.
 */

import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { fromTaggedValue, Tag } from '../core/tagged';
import { SEG_STACK, BYTES_PER_ELEMENT } from '../core/constants';
import { StackUnderflowError, VMError } from '../core/errors';


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
  const slotAddr = vm.SP / BYTES_PER_ELEMENT - startSlot - 1;

  if (slotAddr < 0 || slotAddr * BYTES_PER_ELEMENT >= vm.SP) {
    return [startSlot + 1, 1];
  }

  const addr = slotAddr * BYTES_PER_ELEMENT;
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
 * @param vm - The `VM` instance containing the stack.
 * @param startSlot - The starting slot index (0-based, relative to the stack top).
 * @param slotCount - The number of slots to reverse.
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
 * @param vm - The `VM` instance containing the stack.
 * @param startSlot - The starting slot index (0-based, relative to the stack top).
 * @param rangeSize - The number of slots in the range to rotate.
 * @param shiftSlots - The number of positions to rotate (positive for right rotation, negative for left).
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

// ============================================================================
// STACK OPERATION UTILITIES (from src/ops/builtins-stack.ts)
// ============================================================================

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
    if (currentSlot * BYTES_PER_ELEMENT >= vm.SP) {
      throw new StackUnderflowError('pick', index + 1, vm.getStackData());
    }

    const [nextSlot, size] = findElement(vm, currentSlot);

    if (i === index) {
      const targetSlot = vm.SP / BYTES_PER_ELEMENT - nextSlot;
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

// ============================================================================
// STACK OPERATIONS (from src/ops/builtins-stack.ts)
// ============================================================================

/**
 * Implements the dup (duplicate) operation.
 * Duplicates the top element of the stack, handling both simple values and complex data structures.
 */
export const dupOp: Verb = (vm: VM) => {
  validateStackDepth(vm, 1, 'dup');

  const [tosStartSlot, tosSize] = findElementAtIndex(vm, 0);
  slotsCopy(vm, tosStartSlot, tosSize);
};

/**
 * Implements the over operation.
 * Copies the second element on the stack to the top, preserving the original.
 */
export const overOp: Verb = (vm: VM) => {
  validateStackDepth(vm, 2, 'over');

  const originalSP = vm.SP;

  try {
    const [_topNextSlot, topSlots] = findElement(vm, 0);
    const [_secondNextSlot, secondSlots] = findElement(vm, topSlots);

    const secondAddr = vm.SP - (topSlots + secondSlots) * BYTES_PER_ELEMENT;

    for (let i = 0; i < secondSlots; i++) {
      const value = vm.memory.readFloat32(SEG_STACK, secondAddr + i * BYTES_PER_ELEMENT);
      vm.push(value);
    }
  } catch (error) {
    vm.SP = originalSP;
    throw new Error(`over failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Implements the pick operation.
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
    slotsCopy(vm, targetSlot, targetSize);
  } catch {
    throw new Error(`Stack underflow in pick operation`);
  }
};

/**
 * Implements the drop operation.
 * Removes the top element from the stack. If the top element is a list, removes the entire list structure.
 */
export const dropOp: Verb = (vm: VM) => {
  validateStackDepth(vm, 1, 'drop');
  const topValue = vm.peek();
  const { tag, value } = fromTaggedValue(topValue);
  if (tag === Tag.LIST) {
    const totalSlots = value + 1;
    vm.SP -= totalSlots * BYTES_PER_ELEMENT;
    return;
  }
  vm.pop();
};

/**
 * Implements the swap operation.
 * Exchanges the top two elements on the stack.
 */
export const swapOp: Verb = (vm: VM) => {
  validateStackDepth(vm, 2, 'swap');

  const originalSP = vm.SP;

  try {
    const [_topNextSlot, topSlots] = findElement(vm, 0);
    const [_secondNextSlot, secondSlots] = findElement(vm, topSlots);

    const totalSlots = topSlots + secondSlots;
    const stackLength = vm.SP / BYTES_PER_ELEMENT;
    const startSlot = stackLength - totalSlots;

    slotsRoll(vm, startSlot, totalSlots, topSlots);
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

    slotsRoll(vm, 0, totalSlots, rotationSlots);
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

    slotsRoll(vm, 0, totalSlots, topSlots);
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
 * Removes the second element from the top of the stack (NOS - Next On Stack).
 */
export const nipOp: Verb = (vm: VM) => {
  validateStackDepth(vm, 2, 'nip');

  safeStackOperation(
    vm,
    () => {
      const [_tosNextSlot, tosSize] = findElement(vm, 0);
      const [_nosNextSlot, nosSize] = findElement(vm, tosSize);

      const tosStartAddr = vm.SP - tosSize * BYTES_PER_ELEMENT;
      const nosStartAddr = vm.SP - (tosSize + nosSize) * BYTES_PER_ELEMENT;

      for (let i = 0; i < tosSize; i++) {
        const sourceAddr = tosStartAddr + i * BYTES_PER_ELEMENT;
        const destAddr = nosStartAddr + i * BYTES_PER_ELEMENT;

        const value = vm.memory.readFloat32(SEG_STACK, sourceAddr);
        vm.memory.writeFloat32(SEG_STACK, destAddr, value);
      }

      vm.SP -= nosSize * BYTES_PER_ELEMENT;
    },
    'nip',
  );
};

/**
 * Implements the tuck operation.
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