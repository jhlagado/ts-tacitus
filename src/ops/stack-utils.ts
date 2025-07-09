import { VM } from '../core/vm';
import { SEG_STACK } from '../core/memory';
import { fromTaggedValue, Tag } from '../core/tagged';

const BYTES_PER_ELEMENT = 4;

/**
 * Rotates a range of stack elements in-place.
 * 
 * This utility shifts elements within a specified range by a given amount,
 * similar to an array rotation operation. The operation preserves the
 * relative order within each segment. It uses a simple reversal algorithm
 * to perform rotation with minimal temporary storage (just one element).
 * 
 * @param vm The virtual machine instance
 * @param startDepth Starting position from the stack top in bytes (not elements)
 * @param rangeSize Total size of the range to rotate in bytes (not elements)
 * @param shiftAmount Number of bytes to shift items (positive = right/down, negative = left/up)
 */
export function rangeRoll(vm: VM, startDepth: number, rangeSize: number, shiftAmount: number): void {
  if (rangeSize <= 0 || shiftAmount === 0) {
    return; // Nothing to rotate
  }
  
  // Ensure rangeSize is a multiple of BYTES_PER_ELEMENT
  if (rangeSize % BYTES_PER_ELEMENT !== 0) {
    throw new Error(`Range size (${rangeSize}) must be a multiple of BYTES_PER_ELEMENT (${BYTES_PER_ELEMENT})`);
  }
  
  // Ensure shiftAmount is a multiple of BYTES_PER_ELEMENT
  if (shiftAmount % BYTES_PER_ELEMENT !== 0) {
    throw new Error(`Shift amount (${shiftAmount}) must be a multiple of BYTES_PER_ELEMENT (${BYTES_PER_ELEMENT})`);
  }
  
  // Convert to element-based sizes for easier computation
  const elementCount = rangeSize / BYTES_PER_ELEMENT;
  let elemShift = shiftAmount / BYTES_PER_ELEMENT;
  
  // Normalize shift amount to be within range and handle negative shifts
  // For negative shifts (leftward/upward rotation), convert to equivalent rightward rotation
  elemShift = ((elemShift % elementCount) + elementCount) % elementCount;
  if (elemShift === 0) {
    return; // No shift needed
  }

  // Calculate start address in the stack (in bytes)
  const baseAddr = vm.SP - startDepth - rangeSize;
  
  // Use three reverse algorithm for rotation:
  // To rotate [A][B] -> [B][A]: reverse A, reverse B, then reverse the whole thing
  // For example, with [1,2,3,4] and shift=1:
  // 1. Reverse [1]: [1]
  // 2. Reverse [2,3,4]: [4,3,2]
  // 3. Reverse [1,4,3,2]: [2,3,4,1]
  
  // Important: For right rotation by k, we reverse [0...(n-k-1)] and [(n-k)...n]
  // We're reversing from the right end of the stack, which is the opposite of array rotation
  
  // Calculate rotational boundaries based on direction
  const leftSize = elementCount - elemShift;
  const rightSize = elemShift;
  
  // First, reverse the left part
  reverseRange(vm, baseAddr, leftSize);
  
  // Second, reverse the right part
  reverseRange(vm, baseAddr + (leftSize * BYTES_PER_ELEMENT), rightSize);
  
  // Finally, reverse the entire range
  reverseRange(vm, baseAddr, elementCount);
}

/**
 * Helper function to reverse a range of elements in the stack.
 * 
 * @param vm The virtual machine instance
 * @param startAddr Starting address in bytes
 * @param elementCount Number of elements to reverse
 */
function reverseRange(vm: VM, startAddr: number, elementCount: number): void {
  if (elementCount <= 1) return;
  
  const lastIndex = elementCount - 1;
  for (let i = 0; i < elementCount / 2; i++) {
    const leftAddr = startAddr + (i * BYTES_PER_ELEMENT);
    const rightAddr = startAddr + ((lastIndex - i) * BYTES_PER_ELEMENT);
    
    // Swap elements at leftAddr and rightAddr
    const leftValue = vm.memory.readFloat32(SEG_STACK, leftAddr);
    const rightValue = vm.memory.readFloat32(SEG_STACK, rightAddr);
    
    vm.memory.writeFloat32(SEG_STACK, leftAddr, rightValue);
    vm.memory.writeFloat32(SEG_STACK, rightAddr, leftValue);
  }
}

/**
 * Finds a tuple on the stack.
 * 
 * @param vm The virtual machine instance
 * @param offset Stack offset in bytes from the top of the stack
 * @returns Object containing tuple information or null if not a tuple
 */
export function findTuple(vm: VM, offset: number = 0): { 
  start: number;       // Start address of the tuple (TUPLE tag) in bytes
  end: number;         // End address of the tuple (after LINK tag) in bytes
  size: number;        // Number of elements in the tuple
  totalSize: number;   // Total size in bytes including TUPLE tag and LINK tag
} | null {
  // Check if we have enough elements on the stack
  if (vm.SP <= offset) {
    return null;
  }

  // Check if the element at offset is a LINK tag
  const linkAddr = vm.SP - offset - BYTES_PER_ELEMENT;
  const linkValue = vm.memory.readFloat32(SEG_STACK, linkAddr);
  
  try {
    const linkDecoded = fromTaggedValue(linkValue);
    if (linkDecoded.tag !== Tag.LINK) {
      return null;
    }
    
    // The LINK tag value includes the TUPLE tag, so we need to adjust
    // linkDecoded.value is the total number of elements from TUPLE to just before LINK
    const totalElements = linkDecoded.value;
    
    // Calculate the number of data elements (excluding the TUPLE tag)
    const dataElements = totalElements - 1;
    
    // Calculate total size and position
    const tupleBodySize = totalElements * BYTES_PER_ELEMENT; // Elements + TUPLE tag
    const tupleEnd = linkAddr + BYTES_PER_ELEMENT; // End address (after LINK tag)
    const tupleStart = tupleEnd - tupleBodySize - BYTES_PER_ELEMENT; // -BYTES_PER_ELEMENT for TUPLE tag
    
    // Verify the TUPLE tag
    if (tupleStart < 0) {
      return null; // Invalid tuple structure
    }
    
    const tupleTagValue = vm.memory.readFloat32(SEG_STACK, tupleStart);
    const tupleDecoded = fromTaggedValue(tupleTagValue);
    
    if (tupleDecoded.tag !== Tag.TUPLE) {
      return null;
    }
    
    // Verify the size in TUPLE tag matches our calculation
    if (tupleDecoded.value !== dataElements) {
      return null; // Tuple tag size doesn't match link offset
    }

    return {
      start: tupleStart,
      end: tupleEnd,
      size: dataElements,
      totalSize: tupleBodySize + (2 * BYTES_PER_ELEMENT) // Data elements + TUPLE tag + LINK tag
    };
  } catch (_error) {
    // Invalid tagged value
    return null;
  }
}
