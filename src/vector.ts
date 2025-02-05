import { BLOCK_REFS, BLOCK_SIZE, Heap } from "./heap";
import { NIL } from "./constants";
import { toTagNum, fromTagNum, isTagNum } from "./tagnum";

// Define offsets in the vector block
export const VEC_SIZE = 4; // 2 bytes for length
export const VEC_RESERVED = 6; // 2 bytes reserved for future use
export const VEC_DATA = 8; // Data starts after metadata
export const VECTOR_TAG = 3; // Unique tag for vectors

// Maximum elements in a single block
const ELEMENT_SIZE = 4; // Each element is a 32-bit float
const MAX_VECTOR_LENGTH = (BLOCK_SIZE - VEC_DATA) / ELEMENT_SIZE;

/**
 * Creates a fixed-length vector.
 * @param heap - The heap instance.
 * @param length - Number of elements.
 * @returns The pointer to the vector block.
 */
export function vectorCreate(heap: Heap, length: number): number {
  if (length > MAX_VECTOR_LENGTH) return NIL;

  const block = heap.malloc(BLOCK_SIZE);
  if (block === NIL) return NIL;

  heap.memory.write16(block + VEC_SIZE, length);
  heap.memory.write16(block + VEC_RESERVED, 0);
  heap.memory.write16(block + BLOCK_REFS, 1);

  return toTagNum(VECTOR_TAG, block);
}

/**
 * Retrieves an element from a vector.
 * @param heap - The heap instance.
 * @param vectorPtr - Pointer to the vector block.
 * @param index - Index of the element.
 * @returns The retrieved value or undefined if out of bounds.
 */
export function vectorGet(heap: Heap, vectorPtr: number, index: number): number | undefined {
  if (!isTagNum(vectorPtr)) return undefined;
  const { tag, value: block } = fromTagNum(VECTOR_TAG, vectorPtr);
  if (tag !== VECTOR_TAG) return undefined;

  const length = heap.memory.read16(block + VEC_SIZE);
  if (index < 0 || index >= length) return undefined;

  return heap.memory.readFloat(block + VEC_DATA + index * ELEMENT_SIZE);
}

/**
 * Updates an element in a vector.
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

  const length = heap.memory.read16(block + VEC_SIZE);
  if (index < 0 || index >= length) return NIL;

  // Handle copy-on-write using heap.cloneBlock
  if (heap.memory.read16(block + BLOCK_REFS) > 1) {
    const newBlock = heap.cloneBlock(block);
    if (newBlock === NIL) return NIL;
    block = newBlock;
  }

  heap.memory.writeFloat(block + VEC_DATA + index * ELEMENT_SIZE, value);
  return toTagNum(VECTOR_TAG, block);
}
