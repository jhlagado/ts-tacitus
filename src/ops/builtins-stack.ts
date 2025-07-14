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
import { SEG_STACK } from '../core/memory';
import { findElement } from '../stack/find';
import { slotsRoll, slotsCopy } from '../stack/slots';

/** Number of bytes per stack element */
const BYTES_PER_ELEMENT = 4;

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
 * // Stack before: [... 5]
 * dupOp(vm)
 * // Stack after: [... 5 5]
 * 
 * @example
 * // Stack before: [... (1 2 3)]
 * dupOp(vm)
 * // Stack after: [... (1 2 3) (1 2 3)]
 */
export const dupOp: Verb = (vm: VM) => {
  if (vm.SP < BYTES_PER_ELEMENT) {
    throw new Error(
      `Stack underflow: 'dup' requires 1 operand (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }

  const [tosNext, tosSize] = findElement(vm, 0);

  const tosStartSlot = vm.SP / BYTES_PER_ELEMENT - tosNext;

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
 * // Stack before: [... 3 5]
 * overOp(vm)
 * // Stack after: [... 3 5 3]
 * 
 * @example
 * // Stack before: [... (1 2) 5]
 * overOp(vm)
 * // Stack after: [... (1 2) 5 (1 2)]
 */
export const overOp: Verb = (vm: VM) => {
  if (vm.SP < 2 * BYTES_PER_ELEMENT) {
    throw new Error(
      `Stack underflow: 'over' requires 2 operands (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }

  const [tosNext, _tosSize] = findElement(vm, 0);

  const [nosNext, nosSize] = findElement(vm, tosNext);

  const nosStartSlot = vm.SP / BYTES_PER_ELEMENT - nosNext;

  slotsCopy(vm, nosStartSlot, nosSize);
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
 * // Stack before: [... 10 20 30 1]
 * pickOp(vm)
 * // Stack after: [... 10 20 30 20] (index 1 refers to 20)
 * 
 * @example
 * // Stack before: [... (1 2) 5 2]
 * pickOp(vm)
 * // Stack after: [... (1 2) 5 (1 2)] (index 2 refers to (1 2))
 */
export const pickOp: Verb = (vm: VM) => {
  if (vm.SP < BYTES_PER_ELEMENT) {
    throw new Error(
      `Stack underflow: 'pick' requires an index (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }

  const index = vm.pop();

  if (index < 0) {
    throw new Error(`Invalid index for pick: ${index}`);
  }

  let currentSlot = 0;
  let targetSlot = -1;
  let targetSize = 0;

  for (let i = 0; i <= index; i++) {
    if (currentSlot * BYTES_PER_ELEMENT >= vm.SP) {
      throw new Error(`Stack underflow in pick operation`);
    }

    const [nextSlot, size] = findElement(vm, currentSlot);

    if (i === index) {
      targetSlot = vm.SP / BYTES_PER_ELEMENT - nextSlot;
      targetSize = size;
      break;
    }

    currentSlot = nextSlot;
  }

  if (targetSlot === -1) {
    throw new Error(`Invalid index for pick: ${index}`);
  }

  slotsCopy(vm, targetSlot, targetSize);
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
 * // Stack before: [... 5 10]
 * dropOp(vm)
 * // Stack after: [... 5]
 * 
 * @example
 * // Stack before: [... 5 (1 2 3)]
 * dropOp(vm)
 * // Stack after: [... 5]
 */
export const dropOp: Verb = (vm: VM) => {
  if (vm.SP < BYTES_PER_ELEMENT) {
    throw new Error(
      `Stack underflow: 'drop' requires 1 operand (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }

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
 * // Stack before: [... 5 10]
 * swapOp(vm)
 * // Stack after: [... 10 5]
 * 
 * @example
 * // Stack before: [... (1 2) 5]
 * swapOp(vm)
 * // Stack after: [... 5 (1 2)]
 */
export const swapOp: Verb = (vm: VM) => {
  if (vm.SP < BYTES_PER_ELEMENT * 2) {
    throw new Error(
      `Stack underflow: 'swap' requires 2 operands (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }

  const originalSP = vm.SP;

  try {
    const [_topNextSlot, topSlots] = findElement(vm, 0);
    const _topSize = topSlots * BYTES_PER_ELEMENT;

    const [_secondNextSlot, secondSlots] = findElement(vm, topSlots);
    const _secondSize = secondSlots * BYTES_PER_ELEMENT;

    const totalSlots = topSlots + secondSlots;

    slotsRoll(vm, 0, totalSlots, topSlots);
  } catch (error) {
    vm.SP = originalSP;
    throw error;
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
 * // Stack before: [... 1 2 3]
 * rotOp(vm)
 * // Stack after: [... 2 3 1]
 * 
 * @example
 * // Stack before: [... (1 2) 5 10]
 * rotOp(vm)
 * // Stack after: [... 5 10 (1 2)]
 */
export const rotOp: Verb = (vm: VM) => {
  if (vm.SP < BYTES_PER_ELEMENT * 3) {
    throw new Error(
      `Stack underflow: 'rot' requires 3 operands (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }

  const originalSP = vm.SP;

  try {
    const [_topNextSlot, topSlots] = findElement(vm, 0);
    const _topSize = topSlots * BYTES_PER_ELEMENT;

    const [_midNextSlot, midSlots] = findElement(vm, topSlots);
    const _midSize = midSlots * BYTES_PER_ELEMENT;

    const [_bottomNextSlot, bottomSlots] = findElement(vm, topSlots + midSlots);
    const _bottomSize = bottomSlots * BYTES_PER_ELEMENT;

    const totalSlots = topSlots + midSlots + bottomSlots;

    const rotationSlots = midSlots + topSlots;

    slotsRoll(vm, 0, totalSlots, rotationSlots);
  } catch (error) {
    vm.SP = originalSP;
    throw error;
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
 * // Stack before: [... 1 2 3]
 * revrotOp(vm)
 * // Stack after: [... 3 1 2]
 * 
 * @example
 * // Stack before: [... (1 2) 5 10]
 * revrotOp(vm)
 * // Stack after: [... 10 (1 2) 5]
 */
export const revrotOp: Verb = (vm: VM) => {
  if (vm.SP < BYTES_PER_ELEMENT * 3) {
    throw new Error(
      `Stack underflow: 'revrot' requires 3 operands (stack: ${JSON.stringify(vm.getStackData())})`,
    );
  }

  const originalSP = vm.SP;

  try {
    const [_topNextSlot, topSlots] = findElement(vm, 0);

    const [_midNextSlot, midSlots] = findElement(vm, topSlots);

    const [_bottomNextSlot, bottomSlots] = findElement(vm, topSlots + midSlots);

    const totalSlots = topSlots + midSlots + bottomSlots;

    console.log('Before revrot:');
    const beforeStack = [];
    for (let i = 0; i < totalSlots; i++) {
      const val = vm.memory.readFloat32(SEG_STACK, i * BYTES_PER_ELEMENT);
      const { tag, value } = fromTaggedValue(val);
      console.log(`  [${i}]: ${Tag[tag]}(${value})`);
      beforeStack.push({ tag, value });
    }

    const originalHeader = vm.memory.readFloat32(SEG_STACK, topSlots * BYTES_PER_ELEMENT);
    const { tag: originalTag } = fromTaggedValue(originalHeader);

    slotsRoll(vm, 0, totalSlots, topSlots);

    if (originalTag === Tag.LIST) {
      const newHeader = originalHeader;
      vm.memory.writeFloat32(SEG_STACK, 1 * BYTES_PER_ELEMENT, newHeader);
    }

    console.log('After revrot:');
    for (let i = 0; i < totalSlots; i++) {
      const val = vm.memory.readFloat32(SEG_STACK, i * BYTES_PER_ELEMENT);
      const { tag, value } = fromTaggedValue(val);
      console.log(`  [${i}]: ${Tag[tag]}(${value})`);
    }
  } catch (error) {
    vm.SP = originalSP;
    throw new Error(`revrot failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};
