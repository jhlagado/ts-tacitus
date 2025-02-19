// File: src/vector.ts

import { BLOCK_SIZE, Heap } from "./heap";
import {
  toTaggedValue,
  fromTaggedValue,
  isTaggedValue,
  Tag,
  NIL,
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
  if (firstBlock === NULL) return NIL;

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
      if (currentBlock === NULL) return NIL;
      offset = VEC_DATA;
    }
  }

  return toTaggedValue(Tag.BLOCK, firstBlock);
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
  if (!isTaggedValue(vectorPtr)) return NIL;
  const { tag, value: firstBlock } = fromTaggedValue(Tag.BLOCK, vectorPtr);
  if (tag !== Tag.BLOCK) return NIL;

  // Read the logical length from the first block’s header.
  const length = heap.memory.read16(firstBlock + VEC_SIZE);
  if (index < 0 || index >= length) return NIL;

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
  return NIL;
}

/**
 * Updates an element in a vector, traversing blocks as necessary.
 * Uses the Heap's copyOnWrite method to clone a block if needed before performing the update.
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
  if (!isTaggedValue(vectorPtr)) return NIL;
  // Extract the first block pointer from the tagged vector pointer.
  let { tag, value: origFirstBlock } = fromTaggedValue(Tag.BLOCK, vectorPtr);
  if (tag !== Tag.BLOCK) return NIL;
  let firstBlock = origFirstBlock;

  // Read the logical length from the first block.
  const length = heap.memory.read16(firstBlock + VEC_SIZE);
  if (index < 0 || index >= length) return NIL;

  // Calculate capacity per block.
  const capacityPerBlock = Math.floor((BLOCK_SIZE - VEC_DATA) / ELEMENT_SIZE);

  // Traverse the chain.
  let currentBlock = firstBlock;
  let remainingIndex = index;

  // If the target is in the first block.
  if (remainingIndex < capacityPerBlock) {
    // Use copyOnWrite once.
    currentBlock = heap.copyOnWrite(currentBlock);
    if (currentBlock === NULL) return NULL;
    firstBlock = currentBlock;
    heap.memory.writeFloat(
      currentBlock + VEC_DATA + remainingIndex * ELEMENT_SIZE,
      value
    );
    return toTaggedValue(Tag.BLOCK, firstBlock);
  }

  let prevBlock = currentBlock;
  while (currentBlock !== NULL) {
    if (remainingIndex < capacityPerBlock) {
      // Use copyOnWrite, updating the previous block's pointer if needed.
      currentBlock = heap.copyOnWrite(currentBlock, prevBlock);
      if (currentBlock === NULL) return NULL;
      heap.memory.writeFloat(
        currentBlock + VEC_DATA + remainingIndex * ELEMENT_SIZE,
        value
      );
      return toTaggedValue(Tag.BLOCK, firstBlock);
    }
    remainingIndex -= capacityPerBlock;
    prevBlock = currentBlock;
    currentBlock = heap.getNextBlock(currentBlock);
  }
  return NIL;
}
