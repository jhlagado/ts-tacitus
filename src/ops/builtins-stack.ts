/**
 * @file src/ops/builtins-stack.ts
 *
 * This file implements stack manipulation operations for the Tacit VM.
 *
 * Stack operations are fundamental to the VM's operation, allowing for data manipulation
 * and rearrangement on the stack. These operations handle both simple values and complex
 * data structures like lists, taking into account their variable sizes in memory.
 *
 * The operations include:
 * - dup: Duplicates the top element
 * - over: Copies the second element to the top
 * - pick: Copies an element from a specific depth to the top
 * - drop: Removes the top element
 * - swap: Exchanges the top two elements
 * - rot: Rotates the top three elements
 * - revrot: Reverse rotates the top three elements
 *
 * All operations handle tagged values and maintain proper stack semantics.
 */

import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { fromTaggedValue, Tag } from '../core/tagged';
import { SEG_STACK } from '../core/constants';
import { findElement } from '../stack/find';
import { slotsRoll, slotsCopy } from '../stack/slots';
import { StackUnderflowError, VMError } from '../core/errors';

/** Number of bytes per stack element */
const BYTES_PER_ELEMENT = 4;

/**
 * Finds an element at a specific index in the stack and returns its position and size.
 *
 * @param {VM} vm - The virtual machine instance.
 * @param {number} index - The index of the element to find (0 is the top element).
 * @returns {[number, number]} A tuple containing the slot position and size of the element.
 * @throws {StackUnderflowError} If the index is out of bounds or the stack is not deep enough.
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
 * Uses the VM's ensureStackSize method for consistent error handling.
 *
 * @param {VM} vm - The virtual machine instance.
 * @param {number} requiredElements - The minimum number of elements required.
 * @param {string} operationName - The name of the operation for error reporting.
 * @throws {Error} If the stack doesn't have enough elements.
 */
function validateStackDepth(vm: VM, requiredElements: number, operationName: string): void {
  vm.ensureStackSize(requiredElements, operationName);
}

/**
 * Safely executes a stack operation with error handling and stack pointer restoration.
 *
 * @param {VM} vm - The virtual machine instance.
 * @param {() => void} operation - The operation to execute.
 * @param {string} operationName - The name of the operation for error reporting.
 * @throws {VMError} If the operation fails, with a descriptive error message.
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

/**
 * Gets information about multiple consecutive elements on the stack.
 *
 * @param {VM} vm - The virtual machine instance.
 * @param {number} count - The number of elements to get information for.
 * @returns {Array<{slot: number, size: number}>} Array of element information, from top to bottom.
 * @throws {StackUnderflowError} If there aren't enough elements on the stack.
 */
function getStackElements(vm: VM, count: number): Array<{ slot: number; size: number }> {
  const elements = [];
  let currentSlot = 0;

  for (let i = 0; i < count; i++) {
    const [nextSlot, size] = findElement(vm, currentSlot);
    const slot = vm.SP / BYTES_PER_ELEMENT - nextSlot;
    elements.push({ slot, size });
    currentSlot = nextSlot;
  }

  return elements;
}

/**
 * Implements the dup (duplicate) operation.
 *
 * Duplicates the top element of the stack, handling both simple values and
 * complex data structures like lists. The operation preserves the structure
 * of the duplicated element.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack has fewer than 1 element.
 *
 * @example
 *
 * dupOp(vm)
 *
 *
 * @example
 *
 * dupOp(vm)
 *
 */
export const dupOp: Verb = (vm: VM) => {
  validateStackDepth(vm, 1, 'dup');

  const [tosStartSlot, tosSize] = findElementAtIndex(vm, 0);
  slotsCopy(vm, tosStartSlot, tosSize);
};

/**
 * Implements the over operation.
 *
 * Copies the second element on the stack to the top, preserving the original.
 * Handles both simple values and complex data structures like lists.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack has fewer than 2 elements.
 *
 * @example
 *
 * overOp(vm)
 *
 *
 * @example
 *
 * overOp(vm)
 *
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
 *
 * Copies an element from a specific depth in the stack to the top.
 * The index is taken from the top of the stack, and the element at that
 * index is copied to the top. Handles both simple values and complex data structures.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack is empty, the index is negative, or the index is out of bounds.
 *
 * @example
 *
 * pickOp(vm)
 *
 *
 * @example
 *
 * pickOp(vm)
 *
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
  } catch (error) {
    throw new Error(`Stack underflow in pick operation`);
  }
};

/**
 * Implements the drop operation.
 *
 * Removes the top element from the stack. If the top element is a list (LINK tag),
 * it removes the entire list structure, not just the header.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack is empty.
 *
 * @example
 *
 * dropOp(vm)
 *
 *
 * @example
 *
 * dropOp(vm)
 *
 */
export const dropOp: Verb = (vm: VM) => {
  validateStackDepth(vm, 1, 'drop');

  const topValue = vm.pop();
  const { tag, value } = fromTaggedValue(topValue);
  if (tag === Tag.LINK) {
    const targetSP = vm.SP - value * BYTES_PER_ELEMENT;
    vm.SP = targetSP;
  }
};

/**
 * Implements the swap operation.
 *
 * Exchanges the top two elements on the stack. Handles both simple values
 * and complex data structures like lists, preserving their structure.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack has fewer than 2 elements or if an error occurs during the swap.
 *
 * @example
 *
 * swapOp(vm)
 *
 *
 * @example
 *
 * swapOp(vm)
 *
 */
export const swapOp: Verb = (vm: VM) => {
  validateStackDepth(vm, 2, 'swap');

  const originalSP = vm.SP;

  try {
    // Find top two elements using logical slot offsets
    const [topNextSlot, topSlots] = findElement(vm, 0);
    const [secondNextSlot, secondSlots] = findElement(vm, topSlots);
    
    const totalSlots = topSlots + secondSlots;
    
    // Convert to physical slot indices for slotsRoll
    // The top element starts at physical index (stackLength - topSlots)
    // The range includes both top and second elements 
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
 *
 * Rotates the top three elements on the stack, moving the third element to the top.
 * Transforms [a, b, c] into [b, c, a], where c is the top of the stack.
 * Handles both simple values and complex data structures like lists.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack has fewer than 3 elements or if an error occurs during rotation.
 *
 * @example
 *
 * rotOp(vm)
 *
 *
 * @example
 *
 * rotOp(vm)
 *
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
 *
 * Performs a reverse rotation of the top three elements on the stack.
 * Transforms [a, b, c] into [c, a, b], where c is the top of the stack.
 * Handles both simple values and complex data structures like lists.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack has fewer than 3 elements or if an error occurs during rotation.
 *
 * @example
 *
 * revrotOp(vm)
 *
 *
 * @example
 *
 * revrotOp(vm)
 *
 */
export const revrotOp: Verb = (vm: VM) => {
  validateStackDepth(vm, 3, 'revrot');

  const originalSP = vm.SP;

  try {
    const [_topNextSlot, topSlots] = findElement(vm, 0);
    const [_midNextSlot, midSlots] = findElement(vm, topSlots);
    const [_bottomNextSlot, bottomSlots] = findElement(vm, topSlots + midSlots);

    const totalSlots = topSlots + midSlots + bottomSlots;

    const originalHeader = vm.memory.readFloat32(SEG_STACK, topSlots * BYTES_PER_ELEMENT);
    const { tag: originalTag } = fromTaggedValue(originalHeader);

    slotsRoll(vm, 0, totalSlots, topSlots);

    if (originalTag === Tag.LIST) {
      const newHeader = originalHeader;
      vm.memory.writeFloat32(SEG_STACK, 1 * BYTES_PER_ELEMENT, newHeader);
    }
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
 *
 * Removes the second element from the top of the stack (NOS - Next On Stack).
 * This operation transforms [a, b] into [b], where b is the top of the stack.
 *
 * The operation is list-aware and efficiently calculates the size of both the TOS
 * and NOS elements, then shifts the TOS down to overwrite the NOS. This is more
 * efficient than the naive swap+drop implementation.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {StackUnderflowError} If the stack has fewer than 2 elements.
 * @throws {VMError} If an error occurs during the operation.
 *
 * @example
 * // Stack before: [1, 2] (2 on top)
 * // Stack after:  [2]
 * nipOp(vm)
 *
 * @example
 * // Stack before: [list1, list2] (list2 on top)
 * // Stack after:  [list2]
 * nipOp(vm)
 */
export const nipOp: Verb = (vm: VM) => {
  validateStackDepth(vm, 2, 'nip');

  safeStackOperation(
    vm,
    () => {
      // Find the size of TOS (top element)
      const [_tosNextSlot, tosSize] = findElement(vm, 0);

      // Find the size of NOS (second element)
      const [_nosNextSlot, nosSize] = findElement(vm, tosSize);

      // Calculate addresses in stack memory
      // TOS starts at SP - tosSize * BYTES_PER_ELEMENT
      // NOS starts at SP - (tosSize + nosSize) * BYTES_PER_ELEMENT
      const tosStartAddr = vm.SP - tosSize * BYTES_PER_ELEMENT;
      const nosStartAddr = vm.SP - (tosSize + nosSize) * BYTES_PER_ELEMENT;

      // Copy TOS data down to overwrite NOS position
      for (let i = 0; i < tosSize; i++) {
        const sourceAddr = tosStartAddr + i * BYTES_PER_ELEMENT;
        const destAddr = nosStartAddr + i * BYTES_PER_ELEMENT;

        const value = vm.memory.readFloat32(SEG_STACK, sourceAddr);
        vm.memory.writeFloat32(SEG_STACK, destAddr, value);
      }

      // Adjust stack pointer - we removed nosSize slots (stack grows upwards)
      vm.SP -= nosSize * BYTES_PER_ELEMENT;
    },
    'nip',
  );
};

/**
 * Implements the tuck operation.
 *
 * Duplicates the top element and inserts the copy under the second element.
 * The tuck operation is equivalent to swap followed by over.
 *
 * Transforms [a, b] into [b, a, b], where b is the top of the stack.
 * Handles both simple values and complex data structures like lists.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {StackUnderflowError} If the stack has fewer than 2 elements.
 * @throws {VMError} If an error occurs during the operation.
 *
 * @example
 * // Stack before: [1, 2] (2 on top)
 * // Stack after:  [2, 1, 2]
 * tuckOp(vm)
 *
 * @example
 * // Stack before: [list1, value] (value on top)
 * // Stack after:  [value, list1, value]
 * tuckOp(vm)
 */
export const tuckOp: Verb = (vm: VM) => {
  validateStackDepth(vm, 2, 'tuck');

  safeStackOperation(
    vm,
    () => {
      // Tuck is equivalent to swap followed by over
      // First, swap the top two elements
      swapOp(vm);

      // Then, duplicate the second element (which is now the original top) to the top
      overOp(vm);
    },
    'tuck',
  );
};
