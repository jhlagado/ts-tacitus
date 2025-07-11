import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { fromTaggedValue, toTaggedValue, Tag } from '../core/tagged';

import { SEG_STACK } from '../core/memory';
import { findElement } from '../stack/find';
import { rangeRoll } from '../stack/rotate';

const BYTES_PER_ELEMENT = 4;

export const dupOp: Verb = (vm: VM) => {
  if (vm.SP < BYTES_PER_ELEMENT) {
    throw new Error(
      `Stack underflow: 'dup' requires 1 operand (stack: ${JSON.stringify(vm.getStackData())})`,
    );
  }

  const topValue = vm.peek();
  const { tag, value } = fromTaggedValue(topValue);
  if (tag === Tag.LINK) {
    const elemCount = value + 1;
    const byteOffset = elemCount * BYTES_PER_ELEMENT;
    const startByte = vm.SP - byteOffset;
    for (let i = 0; i < elemCount; i++) {
      const val = vm.memory.readFloat32(SEG_STACK, startByte + i * BYTES_PER_ELEMENT);
      vm.push(val);
    }
  } else {
    vm.push(topValue);
  }
};

export const dropOp: Verb = (vm: VM) => {
  if (vm.SP < BYTES_PER_ELEMENT) {
    throw new Error(
      `Stack underflow: 'drop' requires 1 operand (stack: ${JSON.stringify(vm.getStackData())})`,
    );
  }

  const topValue = vm.pop();
  const { tag, value } = fromTaggedValue(topValue);
  if (tag === Tag.LINK) {
    const targetSP = vm.SP - value * BYTES_PER_ELEMENT;
    vm.SP = targetSP;
  }
};

export const swapOp: Verb = (vm: VM) => {
  // Check for stack underflow
  if (vm.SP < BYTES_PER_ELEMENT * 2) {
    throw new Error(
      `Stack underflow: 'swap' requires 2 operands (stack: ${JSON.stringify(vm.getStackData())})`,
    );
  }

  const originalSP = vm.SP;
  
  try {
    // Calculate the size of the top item (b)
    const [_topNextSlot, topSlots] = findElement(vm, 0);
    const _topSize = topSlots * BYTES_PER_ELEMENT;
    
    // Calculate the size of the second item (a)
    const [_secondNextSlot, secondSlots] = findElement(vm, topSlots);
    const _secondSize = secondSlots * BYTES_PER_ELEMENT;
    
    // Total size of both items in slots
    const totalSlots = topSlots + secondSlots;
    
    // Rotate the two items: [a, b] -> [b, a]
    // The rotation amount is the size of the top item (b)
    rangeRoll(vm, 0, totalSlots, topSlots);
    
  } catch (error) {
    // If anything goes wrong, restore the stack pointer and rethrow the error
    vm.SP = originalSP;
    throw error;
  }
};

export const rotOp: Verb = (vm: VM) => {
  // Check for stack underflow
  if (vm.SP < BYTES_PER_ELEMENT * 3) {
    throw new Error(
      `Stack underflow: 'rot' requires 3 operands (stack: ${JSON.stringify(vm.getStackData())})`,
    );
  }

  const originalSP = vm.SP;
  
  try {
    // Calculate the size of the top item (c)
    const [_topNextSlot, topSlots] = findElement(vm, 0);
    const _topSize = topSlots * BYTES_PER_ELEMENT;
    
    // Calculate the size of the second item (b)
    const [_midNextSlot, midSlots] = findElement(vm, topSlots);
    const _midSize = midSlots * BYTES_PER_ELEMENT;
    
    // Calculate the size of the third item (a)
    const [_bottomNextSlot, bottomSlots] = findElement(vm, topSlots + midSlots);
    const _bottomSize = bottomSlots * BYTES_PER_ELEMENT;
    
    // Total size of the three items in slots
    const totalSlots = topSlots + midSlots + bottomSlots;
    
    // For nested tuples, we need to adjust the rotation amount
    // to ensure we're rotating the correct number of elements
    const rotationSlots = midSlots + topSlots;
    
    // Rotate the three items: [a, b, c] -> [b, c, a]
    rangeRoll(vm, 0, totalSlots, rotationSlots);
    
  } catch (error) {
    // If anything goes wrong, restore the stack pointer and rethrow the error
    vm.SP = originalSP;
    throw error;
  }
};

/**
 * Performs a reverse rotation of the top three elements on the stack.
 * Converts [a, b, c] to [c, a, b]
 * @param vm - The VM instance
 */
export const revrotOp: Verb = (vm: VM) => {
  const originalSP = vm.SP;
  
  try {
    // Find the size of the top element (c)
    const [nextSlot1, topSlots] = findElement(vm, 0);
    
    // Find the size of the second element (b)
    const [nextSlot2, midSlots] = findElement(vm, nextSlot1);
    
    // Calculate the size of the third item (a)
    const [_nextSlot3, bottomSlots] = findElement(vm, nextSlot2);
    
    // Total size of the three items in slots
    const totalSlots = topSlots + midSlots + bottomSlots;
    
    // For reverse rotation: [a, b, c] -> [c, a, b]
    // We can achieve this by rotating right by (topSlots + midSlots) positions
    // which is equivalent to rotating left by bottomSlots positions
    rangeRoll(vm, 0, totalSlots, -bottomSlots);
    
  } catch (error) {
    // If anything goes wrong, restore the stack pointer and rethrow the error
    vm.SP = originalSP;
    throw new Error(`revrot failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};
