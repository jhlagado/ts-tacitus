import { BLOCK_REFS, BLOCK_SIZE, Heap } from "./heap";
import {
  toTaggedValue,
  fromTaggedValue,
  isTaggedValue,
  Tag,
  UNDEF,
} from "../tagged-value";
import { NULL } from "../constants";

// Define offsets in the vector block
export const VEC_SIZE = 4; // 2 bytes for length
export const VEC_RESERVED = 6; // 2 bytes reserved for future use
export const VEC_DATA = 8; // Data starts after metadata

// Each element is a 32-bit float
const ELEMENT_SIZE = 4;

// For vectors, each block reserves VEC_DATA bytes for metadata.
// So the available space per block for elements is:
const capacityPerBlock = Math.floor((BLOCK_SIZE - VEC_DATA) / ELEMENT_SIZE);

export function vectorCreate(heap: Heap, data: number[]): number {
  const length = data.length;
  // Always allocate at least one block, even for an empty vector.
  const numBlocks = length === 0 ? 1 : Math.ceil(length / capacityPerBlock);
  const allocationSize = numBlocks * BLOCK_SIZE;
  const firstBlock = heap.malloc(allocationSize);
  if (firstBlock === NULL) return UNDEF;

  
  // Write metadata: store the logical length and reserved field.
  heap.memory.write16(firstBlock + VEC_SIZE, length);
  heap.memory.write16(firstBlock + VEC_RESERVED, 0);
  
  let currentBlock = firstBlock;
  let dataIndex = 0;
  let offset = VEC_DATA;
  
  while (dataIndex < length) {
    heap.memory.writeFloat(currentBlock + offset, data[dataIndex]);
    offset += ELEMENT_SIZE;
    dataIndex++;
    
    if (offset >= BLOCK_SIZE) {
      currentBlock = heap.getNextBlock(currentBlock);
      if (currentBlock === NULL) return UNDEF;
      offset = VEC_DATA;
    }
  }
  
  return toTaggedValue(Tag.VECTOR, firstBlock);
}

/**
 * Retrieves an element from a vector, traversing multiple blocks if needed.
 * @param heap - The heap instance.
 * @param vectorPtr - Pointer to the vector block.
 * @param index - Index of the element.
 * @returns The retrieved value or UNDEF if out of bounds.
 */
export function vectorGet(
  heap: Heap,
  vectorPtr: number,
  index: number
): number {
  if (!isTaggedValue(vectorPtr)) return UNDEF;
  const { tag, value: firstBlock } = fromTaggedValue(Tag.VECTOR, vectorPtr);
  if (tag !== Tag.VECTOR) return UNDEF;

  // Read the logical length from the first block’s header.
  const length = heap.memory.read16(firstBlock + VEC_SIZE);
  if (index < 0 || index >= length) return UNDEF;

  // Calculate the capacity per block.
  const capacityPerBlock = Math.floor((BLOCK_SIZE - VEC_DATA) / ELEMENT_SIZE);

  let currentBlock = firstBlock;
  let remainingIndex = index;

  while (currentBlock !== NULL) {
    if (remainingIndex < capacityPerBlock) {
      return heap.memory.readFloat(
        currentBlock + VEC_DATA + remainingIndex * ELEMENT_SIZE
      );
    }
    remainingIndex -= capacityPerBlock;
    currentBlock = heap.getNextBlock(currentBlock);
  }
  return UNDEF;
}

/**
 * Updates an element in a vector, traversing blocks as necessary.
 * If copy‑on‑write is triggered (i.e. the block’s ref count is > 1), then
 * the block is cloned and the chain updated accordingly.
 * @param heap - The heap instance.
 * @param vectorPtr - Pointer to the vector block.
 * @param index - Index of the element.
 * @param value - New value to set.
 * @returns Updated vector pointer (with the new first block) or UNDEF if out of bounds.
 */
export function vectorUpdate(
  heap: Heap,
  vectorPtr: number,
  index: number,
  value: number
): number {
  if (!isTaggedValue(vectorPtr)) return UNDEF;
  // Extract the first block pointer from the tagged vector pointer.
  let { tag, value: origFirstBlock } = fromTaggedValue(Tag.VECTOR, vectorPtr);
  if (tag !== Tag.VECTOR) return UNDEF;
  let firstBlock = origFirstBlock;

  // Read the logical length from the first block.
  const length = heap.memory.read16(firstBlock + VEC_SIZE);
  if (index < 0 || index >= length) return UNDEF;

  // Calculate capacity per block.
  const capacityPerBlock = Math.floor((BLOCK_SIZE - VEC_DATA) / ELEMENT_SIZE);

  // We'll use these variables to traverse the chain.
  let currentBlock = firstBlock;
  let remainingIndex = index;

  // If the target is in the first block, handle it here.
  if (remainingIndex < capacityPerBlock) {
    // Trigger copy-on-write if needed.
    if (heap.memory.read16(currentBlock + BLOCK_REFS) > 1) {
      const newBlock = heap.cloneBlock(currentBlock);
      if (newBlock === NULL) return UNDEF;
      // Since we are updating the first block, update our "firstBlock" pointer.
      currentBlock = newBlock;
      firstBlock = newBlock;
    }
    heap.memory.writeFloat(
      currentBlock + VEC_DATA + remainingIndex * ELEMENT_SIZE,
      value
    );
    return toTaggedValue(Tag.VECTOR, firstBlock);
  }

  // Otherwise, traverse through the chain.
  let prevBlock = currentBlock;
  while (currentBlock !== NULL) {
    if (remainingIndex < capacityPerBlock) {
      // We found the block that contains the element.
      if (heap.memory.read16(currentBlock + BLOCK_REFS) > 1) {
        const newBlock = heap.cloneBlock(currentBlock);
        if (newBlock === NULL) return UNDEF;
        // Update the previous block’s pointer to refer to the new block.
        heap.setNextBlock(prevBlock, newBlock);
        currentBlock = newBlock;
      }
      heap.memory.writeFloat(
        currentBlock + VEC_DATA + remainingIndex * ELEMENT_SIZE,
        value
      );
      return toTaggedValue(Tag.VECTOR, firstBlock);
    }
    remainingIndex -= capacityPerBlock;
    prevBlock = currentBlock;
    currentBlock = heap.getNextBlock(currentBlock);
  }
  return UNDEF;
}
