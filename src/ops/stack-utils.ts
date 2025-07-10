import { VM } from '../core/vm';
import { SEG_STACK } from '../core/memory';
import { fromTaggedValue, Tag } from '../core/tagged';

const BYTES_PER_ELEMENT = 4;

/**
 * Finds the next element's offset and size starting from the given offset.
 * @param vm The virtual machine instance
 * @param startSlot Offset in slots from the stack pointer to start searching
 * @returns [nextSlot, elementSize] where:
 *   - nextSlot: slot offset to the next element (startSlot + elementSize)
 *   - elementSize: size of the element in stack slots (1 for simple values, >1 for tuples)
 */
export function findElement(vm: VM, startSlot: number = 0): [number, number] {
  // Calculate the address of the potential element
  const slotAddr = vm.SP / BYTES_PER_ELEMENT - startSlot - 1;
  
  // Check if we're within bounds
  if (slotAddr < 0 || slotAddr * BYTES_PER_ELEMENT >= vm.SP) {
    return [startSlot + 1, 1]; // Move to next slot
  }
  
  // Read the value at the calculated address
  const addr = slotAddr * BYTES_PER_ELEMENT;
  const value = vm.memory.readFloat32(SEG_STACK, addr);
  const { tag, value: tagValue } = fromTaggedValue(value);
  
  // If we find a LINK tag, we need to look back to find the TUPLE tag
  if (tag === Tag.LINK) {
    // The TUPLE tag is at slotAddr - tagValue slots back
    const tupleSlot = slotAddr - tagValue;
    if (tupleSlot >= 0) {
      const tupleAddr = tupleSlot * BYTES_PER_ELEMENT;
      const tupleValue = vm.memory.readFloat32(SEG_STACK, tupleAddr);
      const { tag: tupleTag, value: tupleSize } = fromTaggedValue(tupleValue);
      
      if (tupleTag === Tag.TUPLE) {
        // Total size is tuple elements + TUPLE tag + LINK tag
        const elementSize = tupleSize + 2;
        return [startSlot + elementSize, elementSize];
      }
    }
  }
  
  // For non-tuple values, the size is always 1 slot
  return [startSlot + 1, 1];
}

type StackArgInfo = [number, number]; // [offset, size]

/**
 * Gets information about the stack argument at the given offset from the stack pointer.
 * @param vm The virtual machine instance
 * @param offsetFromSp Offset in bytes from the current stack pointer
 * @returns [nextOffset, size] where:
 *   - nextOffset: offset to the next argument (can be used for subsequent calls)
 *   - size: size of the current argument in bytes
 */
export function getStackArgInfo(vm: VM, offsetFromSp: number): StackArgInfo {
  const addr = vm.SP - offsetFromSp - BYTES_PER_ELEMENT;
  
  // Check if we're looking at a TUPLE tag
  const value = vm.memory.readFloat32(SEG_STACK, addr);
  const { tag, value: tagValue } = fromTaggedValue(value);
  
  if (tag === Tag.TUPLE) {
    // For tuples, the size is (n + 2) * BYTES_PER_ELEMENT
    // where n is the number of elements in the tuple
    const tupleSize = (tagValue + 2) * BYTES_PER_ELEMENT;
    return [offsetFromSp + tupleSize, tupleSize];
  }
  
  // For non-tuple values, the size is always BYTES_PER_ELEMENT
  return [offsetFromSp + BYTES_PER_ELEMENT, BYTES_PER_ELEMENT];
}

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
 * Finds a tuple on the stack by looking for a LINK tag and then finding the matching TUPLE tag.
 * 
 * @param vm The virtual machine instance
 * @param offset Stack offset in bytes from the top of the stack to the LINK tag
 * @returns Object containing tuple information or null if not a valid tuple
 */
export function findTuple(vm: VM, offset: number = 0): { 
  start: number;       // Start address of the tuple (TUPLE tag) in bytes
  end: number;         // End address of the tuple (after LINK tag) in bytes
  size: number;        // Number of elements in the tuple (excluding TUPLE and LINK tags)
  totalSize: number;   // Total size in bytes including TUPLE tag and LINK tag
  linkOffset: number;  // Offset of the LINK tag from the start of the tuple
} | null {
  try {
    // Calculate the absolute position of the potential LINK tag
    // The offset is from the top of the stack to the LINK tag
    const linkAddr = vm.SP - offset - BYTES_PER_ELEMENT;
    
    // Check if we're within stack bounds
    if (linkAddr < 0 || linkAddr >= vm.SP) {
      return null;
    }
    
    // Read and decode the potential LINK tag
    const linkValue = vm.memory.readFloat32(SEG_STACK, linkAddr);
    const linkDecoded = fromTaggedValue(linkValue);
    
    // Must be a LINK tag
    if (linkDecoded.tag !== Tag.LINK) {
      return null;
    }
    
    // The LINK value is the total number of elements from TUPLE to just before LINK
    const totalElements = linkDecoded.value;
    
    // Calculate the start of the tuple (TUPLE tag)
    // We need to go back (totalElements * BYTES_PER_ELEMENT) bytes from the LINK tag
    const tupleStart = linkAddr - (totalElements * BYTES_PER_ELEMENT);
    
    // Verify we have enough stack space for this tuple
    if (tupleStart < 0) {
      return null; // Not enough space for the claimed tuple
    }
    
    // Read and verify the TUPLE tag
    const tupleTagValue = vm.memory.readFloat32(SEG_STACK, tupleStart);
    const tupleDecoded = fromTaggedValue(tupleTagValue);
    
    if (tupleDecoded.tag !== Tag.TUPLE) {
      return null; // No TUPLE tag where expected
    }
    
    // The TUPLE value should be the number of data elements (excluding TUPLE and LINK tags)
    const dataElements = tupleDecoded.value;
    
    // Verify the total elements match (should be dataElements + 1 for the TUPLE tag + data elements)
    if (totalElements !== dataElements + 1) {
      return null; // Size mismatch between TUPLE and LINK tags
    }
    
    // Calculate total size in bytes (TUPLE + data elements + LINK)
    const totalSize = (dataElements + 2) * BYTES_PER_ELEMENT;
    const tupleEnd = tupleStart + totalSize;
    
    return {
      start: tupleStart,
      end: tupleEnd,
      size: dataElements,
      totalSize: totalSize,
      linkOffset: linkAddr - tupleStart  // Offset of LINK tag from tuple start
    };
  } catch (_error) {
    // If anything goes wrong during decoding, it's not a valid tuple
    return null;
  }
}
