import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { Tag, fromTaggedValue } from '../core/tagged';

import { SEG_STACK } from '../core/memory';
import { findTuple, rangeRoll } from './stack-utils';

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
    throw new Error(`Stack underflow: 'swap' requires 2 operands (stack: ${JSON.stringify(vm.getStackData())})`);
  }

  // Check if the top item is a tuple
  const topTuple = findTuple(vm, 0);
  const topSize = topTuple ? topTuple.totalSize : BYTES_PER_ELEMENT;
  
  // Check if the second item is a tuple (accounting for the size of the top item)
  const secondTuple = findTuple(vm, topSize);
  const secondSize = secondTuple ? secondTuple.totalSize : BYTES_PER_ELEMENT;
  
  // If either item is a tuple, use rangeRoll to swap them while preserving their structure
  if (topTuple || secondTuple) {
    // Calculate the total size of both items
    const totalSize = topSize + secondSize;
    
    // Use rangeRoll to rotate the top two items (including their LINK tags if they're tuples)
    // We rotate by topSize bytes to move the first item past the second item
    rangeRoll(vm, 0, totalSize, topSize);
  } else {
    // For simple values, just swap them directly
    const top = vm.pop();
    const second = vm.pop();
    vm.push(top);
    vm.push(second);
  }
};

export const rotOp: Verb = (vm: VM) => {
  if (vm.SP < BYTES_PER_ELEMENT * 3) {
    throw new Error(
      `Stack underflow: 'rot' requires 3 operands (stack: ${JSON.stringify(vm.getStackData())})`,
    );
  }

  const c = vm.pop();
  const b = vm.pop();
  const a = vm.pop();
  vm.push(b);
  vm.push(c);
  vm.push(a);
};

export const negRotOp: Verb = (vm: VM) => {
  if (vm.SP < BYTES_PER_ELEMENT * 3) {
    throw new Error(
      `Stack underflow: '-rot' requires 3 operands (stack: ${JSON.stringify(vm.getStackData())})`,
    );
  }

  const c = vm.pop();
  const b = vm.pop();
  const a = vm.pop();
  vm.push(c);
  vm.push(a);
  vm.push(b);
};
