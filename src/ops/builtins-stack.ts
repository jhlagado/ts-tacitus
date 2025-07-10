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

function getItemSize(vm: VM, offset: number): number {
  const tupleInfo = findTuple(vm, offset);
  return tupleInfo ? tupleInfo.totalSize : 1;
}

function updateTupleLinks(vm: VM, start: number, movedSize: number, shift: number) {
  const stack = vm.getStackData();
  for (let i = 0; i < stack.length; i++) {
    const { tag, value } = fromTaggedValue(stack[i]);
    if (tag === Tag.LINK) {
      if (value >= start && value < start + movedSize) {
        // Link points to moved block, adjust by shift
        stack[i] = toTaggedValue(Tag.LINK, value + shift);
      } else if (value >= start + movedSize && value < start + movedSize + shift) {
        // Link points to block that was shifted down
        stack[i] = toTaggedValue(Tag.LINK, value - movedSize);
      }
    }
  }
}

export const rotOp: Verb = (vm: VM) => {
  // Get the size of the top item (C)
  const sizeC = getItemSize(vm, 0);
  
  // Get the size of the second item (B)
  const sizeB = getItemSize(vm, sizeC);
  
  // Get the size of the third item (A)
  const sizeA = getItemSize(vm, sizeC + sizeB);
  
  // Total size of the three items in elements
  const totalSize = sizeA + sizeB + sizeC;
  
  // Calculate the start position (in elements from the top of the stack)
  // We need to point to the start of the first element (A)
  const startPos = totalSize;
  
  // For the rotation A B C -> B C A, we need to move A to the end
  // This is equivalent to rotating left by sizeA elements
  // But since rangeRoll works with bytes, we need to convert
  
  // The rotation is equivalent to moving the first item to the end
  // So we need to shift by sizeA elements to the right
  const shiftAmount = sizeA * BYTES_PER_ELEMENT;
  const rangeSize = totalSize * BYTES_PER_ELEMENT;
  
  // Use rangeRoll to rotate the three items: A B C -> B C A
  // The startDepth is the offset from the top of the stack to the start of the range
  // Since we're rotating the top 3 items, the start depth is 0 (from the top)
  rangeRoll(
    vm,                    // VM instance
    0,                     // Start depth: 0 means start from the top of the stack
    rangeSize,             // Total size of the range to rotate in bytes
    shiftAmount            // Shift amount in bytes
  );
  
  // Update any LINK tags that might have been affected
  // We moved sizeA elements from the start to the end of the range
  updateTupleLinks(
    vm,                    // VM instance
    0,                     // Start position (from top of stack)
    sizeB + sizeC,         // Size of the moved block in elements
    sizeA                  // Shift amount in elements
  );
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
