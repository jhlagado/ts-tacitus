import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { fromTaggedValue, toTaggedValue, Tag } from '../core/tagged';

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
  
  // Calculate the total size of both items
  const totalSize = topSize + secondSize;
  
  // For top-level swaps, we need to handle LINK tags specially
  if (vm.tupleDepth === 0) {
    // If either item is a tuple, use rangeRoll to swap them while preserving their structure
    if (topTuple || secondTuple) {
      // Save the current stack position
      const originalSP = vm.SP;
      
      try {
        // Use rangeRoll to rotate the top two items (including their LINK tags if they're tuples)
        // We rotate by topSize bytes to move the first item past the second item
        rangeRoll(vm, 0, totalSize, topSize);
        
        // If we're swapping two tuples, we need to update their LINK tags
        if (topTuple && secondTuple) {
          // The tuples have been swapped, so their positions are now reversed
          const firstTuplePos = secondSize;
          const secondTuplePos = 0;
          
          // Update the first tuple's LINK tag (if it has one)
          const firstTupleEnd = firstTuplePos + topSize - BYTES_PER_ELEMENT;
          const firstTupleLink = vm.memory.readFloat32(SEG_STACK, firstTupleEnd);
          const { tag: firstLinkTag } = fromTaggedValue(firstTupleLink);
          if (firstLinkTag === Tag.LINK) {
            // The LINK tag should point to the start of the first tuple
            vm.memory.writeFloat32(SEG_STACK, firstTupleEnd, toTaggedValue(secondSize / BYTES_PER_ELEMENT, Tag.LINK));
          }
          
          // Update the second tuple's LINK tag (if it has one)
          const secondTupleEnd = secondTuplePos + secondSize - BYTES_PER_ELEMENT;
          const secondTupleLink = vm.memory.readFloat32(SEG_STACK, secondTupleEnd);
          const { tag: secondLinkTag } = fromTaggedValue(secondTupleLink);
          if (secondLinkTag === Tag.LINK) {
            // The LINK tag should point to the start of the second tuple
            vm.memory.writeFloat32(SEG_STACK, secondTupleEnd, toTaggedValue(topSize / BYTES_PER_ELEMENT, Tag.LINK));
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

  // Check if any of the top 3 items is a tuple
  const topTuple = findTuple(vm, 0);
  const topSize = topTuple ? topTuple.totalSize : BYTES_PER_ELEMENT;
  
  const midTuple = findTuple(vm, topSize);
  const midSize = midTuple ? midTuple.totalSize : BYTES_PER_ELEMENT;
  
  const bottomTuple = findTuple(vm, topSize + midSize);
  const bottomSize = bottomTuple ? bottomTuple.totalSize : BYTES_PER_ELEMENT;
  
  // If we're not in a tuple context or if all items are simple values
  if (vm.tupleDepth === 0 || (!topTuple && !midTuple && !bottomTuple)) {
    // Simple case: just rotate three values
    const c = vm.pop();
    const b = vm.pop();
    const a = vm.pop();
    vm.push(b);
    vm.push(c);
    vm.push(a);
    return;
  }
  
  // For tuple rotations, we need to handle the memory layout carefully
  const originalSP = vm.SP;
  
  try {
    // Calculate the start of each item
    const topStart = vm.SP - topSize;
    const midStart = topStart - midSize;
    const bottomStart = midStart - bottomSize;
    
    // Create a temporary buffer to hold the rotated items
    const rotated = new ArrayBuffer(topSize + midSize + bottomSize);
    const rotatedView = new DataView(rotated);
    
    // Read the three items into the buffer in the new order: b, c, a
    let offset = 0;
    
    // 1. Copy middle item (b)
    for (let i = 0; i < midSize; i += 4) {
      const value = vm.memory.readFloat32(SEG_STACK, midStart + i);
      rotatedView.setFloat32(offset, value, true);
      offset += 4;
    }
    
    // 2. Copy top item (c)
    for (let i = 0; i < topSize; i += 4) {
      const value = vm.memory.readFloat32(SEG_STACK, topStart + i);
      rotatedView.setFloat32(offset, value, true);
      offset += 4;
    }
    
    // 3. Copy bottom item (a)
    for (let i = 0; i < bottomSize; i += 4) {
      const value = vm.memory.readFloat32(SEG_STACK, bottomStart + i);
      rotatedView.setFloat32(offset, value, true);
      offset += 4;
    }
    
    // Write the rotated items back to memory
    const rotatedFloats = new Float32Array(rotated);
    for (let i = 0; i < rotatedFloats.length; i++) {
      vm.memory.writeFloat32(SEG_STACK, bottomStart + (i * 4), rotatedFloats[i]);
    }
    
    // Update the stack pointer to account for the rotated items
    vm.SP = originalSP;
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
