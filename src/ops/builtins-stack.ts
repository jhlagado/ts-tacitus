import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { fromTaggedValue, Tag } from '../core/tagged';
import { SEG_STACK } from '../core/memory';
import { findElement } from '../stack/find';
import { slotsRoll, slotsCopy } from '../stack/slots';

const BYTES_PER_ELEMENT = 4;

export const dupOp: Verb = (vm: VM) => {
  if (vm.SP < BYTES_PER_ELEMENT) {
    throw new Error(
      `Stack underflow: 'dup' requires 1 operand (stack: ${JSON.stringify(vm.getStackData())})`,
    );
  }

  // Get the top element's next slot and size
  const [tosNext, tosSize] = findElement(vm, 0);

  // Calculate the start slot of the top element
  const tosStartSlot = (vm.SP / BYTES_PER_ELEMENT) - tosNext;

  // Copy the top element to the top of the stack
  slotsCopy(vm, tosStartSlot, tosSize);
};

export const overOp: Verb = (vm: VM) => {
  // Need at least 2 elements on the stack
  if (vm.SP < 2 * BYTES_PER_ELEMENT) {
    throw new Error(
      `Stack underflow: 'over' requires 2 operands (stack: ${JSON.stringify(vm.getStackData())})`,
    );
  }

  // Get the top element's next slot and size
  const [tosNext, _tosSize] = findElement(vm, 0);

  // Get the NOS element's next slot and size
  const [nosNext, nosSize] = findElement(vm, tosNext);

  // Calculate the start slot of NOS element
  const nosStartSlot = (vm.SP / BYTES_PER_ELEMENT) - nosNext;

  // Copy the NOS element to the top of the stack
  slotsCopy(vm, nosStartSlot, nosSize);
};

export const pickOp: Verb = (vm: VM) => {
  // Need at least the index on the stack
  if (vm.SP < BYTES_PER_ELEMENT) {
    throw new Error(
      `Stack underflow: 'pick' requires an index (stack: ${JSON.stringify(vm.getStackData())})`,
    );
  }

  // Get the index from TOS
  const index = vm.pop();

  // Validate the index
  if (index < 0) {
    throw new Error(`Invalid index for pick: ${index}`);
  }

  // Start from the top of the stack (after popping the index)
  let currentSlot = 0;
  let targetSlot = -1;
  let targetSize = 0;

  // Traverse the stack to find the element at the specified index
  for (let i = 0; i <= index; i++) {
    if (currentSlot * BYTES_PER_ELEMENT >= vm.SP) {
      throw new Error(`Stack underflow in pick operation`);
    }

    const [nextSlot, size] = findElement(vm, currentSlot);

    if (i === index) {
      // Found the target element
      targetSlot = (vm.SP / BYTES_PER_ELEMENT) - nextSlot;
      targetSize = size;
      break;
    }

    // Move to the next element
    currentSlot = nextSlot;
  }

  if (targetSlot === -1) {
    throw new Error(`Invalid index for pick: ${index}`);
  }

  // Copy the target element to the top of the stack
  slotsCopy(vm, targetSlot, targetSize);
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
  if (vm.SP < BYTES_PER_ELEMENT * 2) {
    throw new Error(
      `Stack underflow: 'swap' requires 2 operands (stack: ${JSON.stringify(vm.getStackData())})`,
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

export const rotOp: Verb = (vm: VM) => {
  if (vm.SP < BYTES_PER_ELEMENT * 3) {
    throw new Error(
      `Stack underflow: 'rot' requires 3 operands (stack: ${JSON.stringify(vm.getStackData())})`,
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
 * Performs a reverse rotation of the top three elements on the stack.
 * Converts [a, b, c] to [c, a, b]
 * @param vm - The VM instance
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
