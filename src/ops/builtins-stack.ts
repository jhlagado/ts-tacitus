import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { fromTaggedValue, toTaggedValue, Tag } from '../core/tagged';

import { SEG_STACK } from '../core/memory';
import { findTupleSlots } from '../stack/find';
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
    throw new Error(`Stack underflow: 'swap' requires 2 operands (stack: ${JSON.stringify(vm.getStackData())})`);
  }

  // Check if the top item is a tuple
  const [_topNextSlot, topSizeInSlots] = findTupleSlots(vm, 0);
  const topSlots = topSizeInSlots;
  const topSize = topSlots * BYTES_PER_ELEMENT;
  
  // Check if the second item is a tuple (accounting for the size of the top item)
  const [_secondNextSlot, secondSizeInSlots] = findTupleSlots(vm, topSlots);
  const secondSlots = secondSizeInSlots;
  const secondSize = secondSlots * BYTES_PER_ELEMENT;
  
  // Calculate the total size of both items in slots
  const totalSlots = topSlots + secondSlots;
  
  // For top-level swaps, we need to handle LINK tags specially
  if (vm.tupleDepth === 0) {
    // If either item is a tuple, use rangeRoll to swap them while preserving their structure
    if (topSlots > 1 || secondSlots > 1) {
      // Save the current stack position
      const originalSP = vm.SP;
      
      try {
        // Use rangeRoll to rotate the top two items (including their LINK tags if they're tuples)
        // We rotate by topSlots to move the first item past the second item
        rangeRoll(vm, 0, totalSlots, topSlots);
        
        // If we're swapping two tuples, we need to update their LINK tags
        if (topSlots > 1 && secondSlots > 1) {
          // The tuples have been swapped, so their positions are now reversed
          const firstTuplePos = secondSlots * BYTES_PER_ELEMENT;
          const secondTuplePos = 0;
          
          // Update the first tuple's LINK tag (if it has one)
          const firstTupleEnd = firstTuplePos + topSize - BYTES_PER_ELEMENT;
          const firstTupleLink = vm.memory.readFloat32(SEG_STACK, firstTupleEnd);
          const { tag: firstLinkTag } = fromTaggedValue(firstTupleLink);
          if (firstLinkTag === Tag.LINK) {
            // The LINK tag should point to the start of the first tuple
            vm.memory.writeFloat32(SEG_STACK, firstTupleEnd, toTaggedValue(secondSlots, Tag.LINK));
          }
          
          // Update the second tuple's LINK tag (if it has one)
          const secondTupleEnd = secondTuplePos + secondSize - BYTES_PER_ELEMENT;
          const secondTupleLink = vm.memory.readFloat32(SEG_STACK, secondTupleEnd);
          const { tag: secondLinkTag } = fromTaggedValue(secondTupleLink);
          if (secondLinkTag === Tag.LINK) {
            // The LINK tag should point to the start of the second tuple
            vm.memory.writeFloat32(SEG_STACK, secondTupleEnd, toTaggedValue(topSlots, Tag.LINK));
          }
        }
        return;
      } catch (error) {
        // If anything goes wrong, restore the stack pointer and rethrow the error
        vm.SP = originalSP;
        throw error;
      }
    }
  }
  
  // For simple values or when inside a tuple, just swap the top two elements
  const top = vm.pop();
  const second = vm.pop();
  vm.push(top);
  vm.push(second);
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
    const [_topNextSlot, topSlots] = findTupleSlots(vm, 0);
    const _topSize = topSlots * BYTES_PER_ELEMENT;
    
    // Calculate the size of the second item (b)
    const [_midNextSlot, midSlots] = findTupleSlots(vm, topSlots);
    const _midSize = midSlots * BYTES_PER_ELEMENT;
    
    // Calculate the size of the third item (a)
    const [_bottomNextSlot, bottomSlots] = findTupleSlots(vm, topSlots + midSlots);
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
