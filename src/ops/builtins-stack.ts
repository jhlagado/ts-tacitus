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

    rangeRoll(vm, 0, totalSlots, topSlots);
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

    rangeRoll(vm, 0, totalSlots, rotationSlots);
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

    rangeRoll(vm, 0, totalSlots, topSlots);

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
