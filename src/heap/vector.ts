/**
 * @fileOverview This file implements vectors, a fundamental data structure in Tacit,
 * built upon the heap management system.  It provides functions for creating,
 * accessing, and updating vectors, utilizing a copy-on-write mechanism for
 * efficient updates and immutability.
 *
 * @architectural_observation Vectors are implemented as contiguous arrays of
 * 32-bit floats stored in one or more heap blocks. Multi-block vectors are
 * supported for large sizes, with blocks linked together using the heap's block
 * linking mechanism. A copy-on-write strategy is employed to maintain
 * immutability while allowing efficient updates: updates create copies of only
 * the blocks containing the modified data.
 */

import { BLOCK_SIZE, USABLE_BLOCK_SIZE, Heap } from './heap';
import { toTaggedValue, fromTaggedValue, NIL, HeapTag } from '../core/tagged';
import { INVALID } from '../core/constants';
import { SEG_HEAP } from '../core/memory';

/**
 * Offset within a heap block where the vector's size (length) is stored (2 bytes).
 * Vector blocks reuse the heap block header, with vector-specific data following.
 */
export const VEC_SIZE = 4;

/**
 * Offset for a reserved field (2 bytes). Currently unused, but may be used for
 * additional vector metadata in the future.
 */
export const VEC_RESERVED = 6;

/**
 * Offset within a heap block where the vector's data (array of 32-bit floats)
 * begins. Vector metadata (size, reserved) precedes the data.
 */
export const VEC_DATA = 8;

/**
 * Size of each element in the vector (32-bit float = 4 bytes).  All vectors in
 * this implementation store 32-bit floating point numbers.
 */
const ELEMENT_SIZE = 4;

/**
 * Calculates the maximum number of elements that can be stored in a single heap
 * block for a vector.  This is determined by subtracting the size of the vector
 * metadata from the usable block size and then dividing by the size of each
 * element.
 */
const capacityPerBlock = Math.floor((USABLE_BLOCK_SIZE - (VEC_DATA - 4)) / ELEMENT_SIZE);

/**
 * Creates a new vector on the heap and initializes it with the provided data.
 *
 * @param heap The heap instance where the vector will be allocated.
 * @param data An array of numbers representing the initial vector data.
 * @returns A tagged value representing a pointer to the newly created vector, or
 * `NIL` if allocation fails. The tagged value uses `HeapTag.VECTOR`.
 */
export function vectorCreate(heap: Heap, data: number[]): number {
  const length = data.length;
  const numBlocks = length === 0 ? 1 : Math.ceil(length / capacityPerBlock);
  const allocationSize = numBlocks * USABLE_BLOCK_SIZE;
  const firstBlock = heap.malloc(allocationSize);
  if (firstBlock === INVALID) return NIL;

  // Write vector metadata: logical length and reserved field.
  heap.memory.write16(SEG_HEAP, heap.blockToByteOffset(firstBlock) + VEC_SIZE, length);
  heap.memory.write16(SEG_HEAP, heap.blockToByteOffset(firstBlock) + VEC_RESERVED, 0);

  let currentBlock = firstBlock;
  let dataIndex = 0;
  let offset = VEC_DATA;

  while (dataIndex < length) {
    heap.memory.writeFloat(
      SEG_HEAP,
      heap.blockToByteOffset(currentBlock) + offset,
      data[dataIndex]
    );
    dataIndex++;
    offset += ELEMENT_SIZE;

    // When we've filled the current block's payload, move to the next block.
    if (offset >= BLOCK_SIZE) {
      currentBlock = heap.getNextBlock(currentBlock);
      if (currentBlock === INVALID) return NIL;
      offset = VEC_DATA;
    }
  }

  return toTaggedValue(firstBlock, true, HeapTag.VECTOR);
}

/**
 * Retrieves an element from a vector.
 */
/**
 * Retrieves an element from a vector at the specified index.
 *
 * @param heap The heap instance where the vector is stored.
 * @param vectorPtr A tagged value representing a pointer to the vector.
 * @param index The index of the element to retrieve.
 * @returns The value of the element at the specified index, or `NIL` if the
 * index is out of bounds.
 */
export function vectorGet(heap: Heap, vectorPtr: number, index: number): number {
  const { value: firstBlock } = fromTaggedValue(vectorPtr);
  const length = heap.memory.read16(SEG_HEAP, heap.blockToByteOffset(firstBlock) + VEC_SIZE);
  if (index < 0 || index >= length) return NIL;

  let currentBlock = firstBlock;
  let remainingIndex = index;

  while (currentBlock !== INVALID) {
    if (remainingIndex < capacityPerBlock) {
      return heap.memory.readFloat(
        SEG_HEAP,
        heap.blockToByteOffset(currentBlock) + VEC_DATA + remainingIndex * ELEMENT_SIZE
      );
    }
    remainingIndex -= capacityPerBlock;
    currentBlock = heap.getNextBlock(currentBlock);
  }
  return NIL;
}

/**
 * Updates an element in a vector, triggering copy-on-write if necessary.
 */
/**
 * Updates an element at the specified index in a vector with a new value.  This
 * function uses a copy-on-write mechanism: if the target block is shared (has a
 * reference count > 1), it is copied before the update. This ensures
 * immutability of the original vector.
 *
 * @param heap The heap instance where the vector is stored.
 * @param vectorPtr A tagged value representing a pointer to the vector.
 * @param index The index of the element to update.
 * @param value The new value to set at the specified index.
 */
export function vectorUpdate(heap: Heap, vectorPtr: number, index: number, value: number): number {
  let { value: origFirstBlock } = fromTaggedValue(vectorPtr);
  let firstBlock = origFirstBlock;

  const length = heap.memory.read16(SEG_HEAP, heap.blockToByteOffset(firstBlock) + VEC_SIZE);
  if (index < 0 || index >= length) return NIL;

  let currentBlock = firstBlock;
  let remainingIndex = index;

  // If target element is in the first block:
  if (remainingIndex < capacityPerBlock) {
    currentBlock = heap.copyOnWrite(currentBlock);
    if (currentBlock === INVALID) return INVALID;
    firstBlock = currentBlock;
    heap.memory.writeFloat(
      SEG_HEAP,
      heap.blockToByteOffset(currentBlock) + VEC_DATA + remainingIndex * ELEMENT_SIZE,
      value
    );
    return toTaggedValue(firstBlock, true, HeapTag.VECTOR);
  }

  let prevBlock = currentBlock;
  while (currentBlock !== INVALID) {
    if (remainingIndex < capacityPerBlock) {
      currentBlock = heap.copyOnWrite(currentBlock, prevBlock);
      if (currentBlock === INVALID) return INVALID;
      heap.memory.writeFloat(
        SEG_HEAP,
        heap.blockToByteOffset(currentBlock) + VEC_DATA + remainingIndex * ELEMENT_SIZE,
        value
      );
      return toTaggedValue(firstBlock, true, HeapTag.VECTOR);
    }
    remainingIndex -= capacityPerBlock;
    prevBlock = currentBlock;
    currentBlock = heap.getNextBlock(currentBlock);
  }
  return NIL;
}
