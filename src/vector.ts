import { BLOCK_REFS, BLOCK_SIZE, Heap } from "./heap";
import { NIL } from "./constants";
import { toTagNum, fromTagNum, isTagNum } from "./tagnum";

// Define offsets in the vector block
export const VEC_SIZE = 4; // 2 bytes for length
export const VEC_RESERVED = 6; // 2 bytes reserved for future use
export const VEC_DATA = 8; // Data starts after metadata
export const VECTOR_TAG = 3; // Unique tag for vectors

// Each element is a 32-bit float
const ELEMENT_SIZE = 4;
const BLOCK_CAPACITY = Math.floor((BLOCK_SIZE - VEC_DATA) / ELEMENT_SIZE);

/**
 * Creates a vector with initial data, allocating multiple blocks if necessary.
 * @param heap - The heap instance.
 * @param data - JavaScript array of numbers to initialize the vector.
 * @returns The pointer to the vector block.
 */
export function vectorCreate(heap: Heap, data: number[]): number {
  const length = data.length;
  const totalBytes = length * ELEMENT_SIZE;
  const firstBlock = heap.malloc(totalBytes + VEC_DATA);
  if (firstBlock === NIL) return NIL;

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
      if (currentBlock === NIL) return NIL;
      offset = VEC_DATA;
    }
  }

  return toTagNum(VECTOR_TAG, firstBlock);
}

/**
 * Retrieves an element from a vector, traversing multiple blocks if needed.
 * @param heap - The heap instance.
 * @param vectorPtr - Pointer to the vector block.
 * @param index - Index of the element.
 * @returns The retrieved value or undefined if out of bounds.
 */
export function vectorGet(heap: Heap, vectorPtr: number, index: number): number | undefined {
  if (!isTagNum(vectorPtr)) return undefined;
  const { tag, value: block } = fromTagNum(VECTOR_TAG, vectorPtr);
  if (tag !== VECTOR_TAG) return undefined;

  let currentBlock = block;
  let remainingIndex = index;

  while (currentBlock !== NIL) {
    if (remainingIndex < BLOCK_CAPACITY) {
      return heap.memory.readFloat(currentBlock + VEC_DATA + remainingIndex * ELEMENT_SIZE);
    }
    remainingIndex -= BLOCK_CAPACITY;
    currentBlock = heap.getNextBlock(currentBlock);
  }
  return undefined;
}

/**
 * Updates an element in a vector, traversing blocks as necessary.
 * @param heap - The heap instance.
 * @param vectorPtr - Pointer to the vector block.
 * @param index - Index of the element.
 * @param value - New value to set.
 * @returns Updated vector pointer.
 */
export function vectorUpdate(heap: Heap, vectorPtr: number, index: number, value: number): number {
  if (!isTagNum(vectorPtr)) return NIL;
  let { tag, value: block } = fromTagNum(VECTOR_TAG, vectorPtr);
  if (tag !== VECTOR_TAG) return NIL;

  let currentBlock = block;
  let remainingIndex = index;

  while (currentBlock !== NIL) {
    if (remainingIndex < BLOCK_CAPACITY) {
      // Handle copy-on-write using heap.cloneBlock
      if (heap.memory.read16(currentBlock + BLOCK_REFS) > 1) {
        const newBlock = heap.cloneBlock(currentBlock);
        if (newBlock === NIL) return NIL;
        currentBlock = newBlock;
      }
      heap.memory.writeFloat(currentBlock + VEC_DATA + remainingIndex * ELEMENT_SIZE, value);
      return toTagNum(VECTOR_TAG, block);
    }
    remainingIndex -= BLOCK_CAPACITY;
    currentBlock = heap.getNextBlock(currentBlock);
  }
  return NIL;
}
