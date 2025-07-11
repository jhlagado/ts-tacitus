import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { fromTaggedValue, Tag } from '../core/tagged';

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
  // Check for stack underflow
  if (vm.SP < BYTES_PER_ELEMENT * 3) {
    throw new Error(
      `Stack underflow: 'revrot' requires 3 operands (stack: ${JSON.stringify(vm.getStackData())})`,
    );
  }

  const originalSP = vm.SP;

  try {
    // Find the size of the top element (c)
    const [_topNextSlot, topSlots] = findElement(vm, 0);

    // Find the size of the second element (b)
    const [_midNextSlot, midSlots] = findElement(vm, topSlots);

    // Calculate the size of the third item (a)
    const [_bottomNextSlot, bottomSlots] = findElement(vm, topSlots + midSlots);

    // Total size of the three items in slots
    const totalSlots = topSlots + midSlots + bottomSlots;

    console.log('Before revrot:');
    const beforeStack = [];
    for (let i = 0; i < totalSlots; i++) {
      const val = vm.memory.readFloat32(SEG_STACK, i * BYTES_PER_ELEMENT);
      const { tag, value } = fromTaggedValue(val);
      console.log(`  [${i}]: ${Tag[tag]}(${value})`);
      beforeStack.push({ tag, value });
    }
    
    // For reverse rotation of [a, b, c] -> [c, a, b]
    // We need to preserve the TUPLE tag value (5) in the header
    const originalHeader = vm.memory.readFloat32(SEG_STACK, topSlots * BYTES_PER_ELEMENT);
    const { tag: originalTag } = fromTaggedValue(originalHeader);
    
    // Rotate right by the size of the last element (c)
    rangeRoll(vm, 0, totalSlots, topSlots);
    
    // If the middle element was a tuple, restore its header with the correct tag
    if (originalTag === Tag.TUPLE) {
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
    // If anything goes wrong, restore the stack pointer and rethrow the error
    vm.SP = originalSP;
    throw new Error(`revrot failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};
