import { VM } from './vm';
import { SEG_STACK } from './memory';
import { fromTaggedValue, Tag } from './tagged';

// Each element on the stack is 4 bytes (32-bit float)
const BYTES_PER_ELEMENT = 4;

/**
 * Reverse the elements in a range of the stack from start to end - 1
 * @param vm The virtual machine
 * @param start Start offset in bytes from the base of the stack
 * @param end End offset in bytes from the base of the stack (exclusive)
 */
export function reverseRange(vm: VM, start: number, end: number): void {
  // Work in terms of bytes, not elements
  let left = start;
  let right = end - BYTES_PER_ELEMENT;
  
  // Use a temp variable to swap bytes
  let temp: number;
  
  while (left < right) {
    // Swap the elements at left and right
    temp = vm.memory.readFloat32(SEG_STACK, left);
    vm.memory.writeFloat32(SEG_STACK, left, vm.memory.readFloat32(SEG_STACK, right));
    vm.memory.writeFloat32(SEG_STACK, right, temp);
    
    // Move inward
    left += BYTES_PER_ELEMENT;
    right -= BYTES_PER_ELEMENT;
  }
}

/**
 * Rotate the elements in a range of the stack.
 * Uses the three-reversal algorithm for in-place rotation.
 * @param vm The virtual machine
 * @param start Start offset in bytes from the base of the stack
 * @param end End offset in bytes from the base of the stack (exclusive)
 * @param shiftBytes Number of bytes to shift by (positive for right rotation, negative for left)
 */
export function rangeRoll(vm: VM, start: number, end: number, shiftBytes: number): void {
  // Handle empty ranges and no-op shift amounts
  if (start >= end || shiftBytes === 0) {
    return;
  }
  
  // Normalize shift amount to be within range size
  const rangeSize = end - start;
  shiftBytes = ((shiftBytes % rangeSize) + rangeSize) % rangeSize;
  
  // No need to shift if the amount is 0
  if (shiftBytes === 0) {
    return;
  }
  
  // Use the three-reversal algorithm:
  // 1. Reverse the first part (0 to shiftBytes)
  reverseRange(vm, start, start + shiftBytes);
  
  // 2. Reverse the second part (shiftBytes to end)
  reverseRange(vm, start + shiftBytes, end);
  
  // 3. Reverse the entire range
  reverseRange(vm, start, end);
}

/**
 * Find a tuple on the stack, starting from the given offset.
 * @param vm The virtual machine
 * @param offset Offset in bytes from the base of the stack
 * @returns Object with tuple information or null if not found
 */
export function findTuple(vm: VM, offset: number): { start: number, end: number, size: number } | null {
  // Check if we're within bounds of the stack
  if (offset >= vm.SP) {
    return null;
  }
  
  // Read the value at the given offset
  const value = vm.memory.readFloat32(SEG_STACK, offset);
  const decoded = fromTaggedValue(value);
  
  // Check if this is a tuple (starts with TUPLE tag)
  if (decoded.tag !== Tag.TUPLE) {
    return null;
  }
  
  // Get the tuple size (number of elements, excluding the TUPLE and LINK tags)
  const size = decoded.value;
  
  // Calculate the end offset (start + TUPLE tag + elements + LINK tag)
  const end = offset + (size + 2) * BYTES_PER_ELEMENT;
  
  // Validate the LINK tag at the end
  if (end <= vm.SP) {
    const linkValue = vm.memory.readFloat32(SEG_STACK, end - BYTES_PER_ELEMENT);
    const linkDecoded = fromTaggedValue(linkValue);
    
    if (linkDecoded.tag === Tag.LINK) {
      return {
        start: offset,
        end: end,
        size: size
      };
    }
  }
  
  // If we couldn't validate the LINK tag, this is not a valid tuple
  return null;
}

/**
 * Calculate the total size of a tuple in bytes (including TUPLE tag, elements, and LINK tag),
 * accounting for nested tuples which take up more memory than their declared size.
 * @param vm The virtual machine
 * @param offset Offset in bytes from the base of the stack to the start of the tuple
 * @returns Size of tuple in bytes or 0 if not a tuple
 */
export function getTupleSize(vm: VM, offset: number): number {
  // Read the value at the given offset to check if it's a tuple
  if (offset >= vm.SP) {
    return 0; // Out of bounds
  }
  
  const value = vm.memory.readFloat32(SEG_STACK, offset);
  const decoded = fromTaggedValue(value);
  
  // Check if this is a tuple (starts with TUPLE tag)
  if (decoded.tag !== Tag.TUPLE) {
    return 0; // Not a tuple
  }
  
  // Get the declared tuple size (number of elements, excluding the TUPLE and LINK tags)
  const declaredSize = decoded.value;
  
  // Start from after the TUPLE tag to examine each element
  let currentOffset = offset + BYTES_PER_ELEMENT;
  let actualSizeBytes = BYTES_PER_ELEMENT; // Start with size of the TUPLE tag
  
  // Scan through each element in the tuple
  for (let i = 0; i < declaredSize; i++) {
    // Check if we're still within bounds
    if (currentOffset >= vm.SP) {
      return 0; // Invalid tuple structure
    }
    
    // Check if the current element is itself a tuple
    const elementValue = vm.memory.readFloat32(SEG_STACK, currentOffset);
    const elementDecoded = fromTaggedValue(elementValue);
    
    if (elementDecoded.tag === Tag.TUPLE) {
      // Found a nested tuple - get its size recursively
      const nestedTupleSize = getTupleSize(vm, currentOffset);
      if (nestedTupleSize === 0) {
        return 0; // Invalid nested tuple
      }
      
      // Add the nested tuple's size and move past it
      actualSizeBytes += nestedTupleSize;
      currentOffset += nestedTupleSize;
    } else {
      // Regular element - just add its size and move to next element
      actualSizeBytes += BYTES_PER_ELEMENT;
      currentOffset += BYTES_PER_ELEMENT;
    }
  }
  
  // Add the LINK tag at the end
  actualSizeBytes += BYTES_PER_ELEMENT;
  
  // Verify the LINK tag exists at the expected position
  if (currentOffset < vm.SP) {
    const linkValue = vm.memory.readFloat32(SEG_STACK, currentOffset);
    const linkDecoded = fromTaggedValue(linkValue);
    if (linkDecoded.tag !== Tag.LINK) {
      return 0; // Invalid tuple - missing or incorrect LINK tag
    }
  } else {
    return 0; // No space for LINK tag, invalid tuple
  }
  
  return actualSizeBytes;
}

/**
 * Find the ending offset of a tuple
 * @param vm The virtual machine
 * @param tupleStartOffset Offset in bytes to the start of a tuple
 * @returns Ending offset in bytes or the input offset if not a tuple
 */
export function getTupleEndOffset(vm: VM, tupleStartOffset: number): number {
  const tuple = findTuple(vm, tupleStartOffset);
  return tuple ? tuple.end : tupleStartOffset;
}

/**
 * Safely rotate a specific number of complete tuples
 * @param vm The virtual machine
 * @param startOffset Offset in bytes where the tuples begin
 * @param shiftAmount Number of tuples to shift (positive for right, negative for left)
 * @param tupleCount Total number of tuples to consider
 * @returns True if rotation successful, false if validation failed
 */
export function rotateTuples(vm: VM, startOffset: number, shiftAmount: number, tupleCount: number): boolean {
  if (tupleCount <= 0 || shiftAmount === 0) {
    return true; // No-op
  }
  
  // Find all tuple boundaries
  const tupleBoundaries: number[] = [];
  let currentOffset = startOffset;
  
  // Collect tuple boundaries
  for (let i = 0; i < tupleCount; i++) {
    const tuple = findTuple(vm, currentOffset);
    if (!tuple) {
      return false; // Tuple validation failed
    }
    
    tupleBoundaries.push(currentOffset);
    currentOffset = tuple.end;
  }
  
  // Add the final end boundary
  const lastTuple = findTuple(vm, tupleBoundaries[tupleCount - 1]);
  if (!lastTuple) {
    return false;
  }
  tupleBoundaries.push(lastTuple.end);
  
  // Calculate total bytes in the range (not needed for calculation but useful for debugging)
  const _totalRange = tupleBoundaries[tupleCount] - tupleBoundaries[0];
  
  // Normalize shift amount
  const normalizedShift = ((shiftAmount % tupleCount) + tupleCount) % tupleCount;
  if (normalizedShift === 0) {
    return true; // No-op
  }
  
  // Calculate the byte shift amount based on where the tuple boundaries are
  const shiftOffset = tupleBoundaries[normalizedShift] - tupleBoundaries[0];
  
  // Perform the rotation
  rangeRoll(vm, tupleBoundaries[0], tupleBoundaries[tupleCount], shiftOffset);
  
  return true;
}
