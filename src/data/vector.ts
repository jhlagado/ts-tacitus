import { BLOCK_SIZE, USABLE_BLOCK_SIZE, Heap } from "../core/heap";
import {
  toTaggedValue,
  fromTaggedValue,
  NIL,
  HeapTag,
} from "../core/tagged-value";
import { INVALID } from "../core/constants";
import { SEG_HEAP } from "../core/memory";

// Define offsets in the vector block (the block layout reuses the heap header):
// - Bytes 0-1: BLOCK_NEXT (heap linkage)
// - Bytes 2-3: BLOCK_REFS (heap ref count)
// - Bytes 4-5: VEC_SIZE (vector length)
// - Bytes 6-7: VEC_RESERVED (reserved)
// - Bytes 8-...: Vector data (32-bit floats)
export const VEC_SIZE = 4; // Offset for length (2 bytes)
export const VEC_RESERVED = 6; // Reserved (2 bytes)
export const VEC_DATA = 8; // Data starts after metadata

// Each element is a 32-bit float (4 bytes)
const ELEMENT_SIZE = 4;

// The available space for vector elements per block is based on the payload size.
// Heap block payload = USABLE_BLOCK_SIZE (which equals BLOCK_SIZE - 4).
// In that payload, vector metadata occupies bytes [0, VEC_DATA - 4] (i.e. 4 bytes),
// so available bytes for elements = USABLE_BLOCK_SIZE - (VEC_DATA - 4).
const capacityPerBlock = Math.floor(
  (USABLE_BLOCK_SIZE - (VEC_DATA - 4)) / ELEMENT_SIZE
);

export function vectorCreate(heap: Heap, data: number[]): number {
  const length = data.length;
  // Always allocate at least one block.
  const numBlocks = length === 0 ? 1 : Math.ceil(length / capacityPerBlock);
  // Request payload size equal to numBlocks * USABLE_BLOCK_SIZE.
  const allocationSize = numBlocks * USABLE_BLOCK_SIZE;
  const firstBlock = heap.malloc(allocationSize);
  if (firstBlock === INVALID) return NIL;

  // Write vector metadata: logical length and reserved field.
  heap.memory.write16(SEG_HEAP, firstBlock + VEC_SIZE, length);
  heap.memory.write16(SEG_HEAP, firstBlock + VEC_RESERVED, 0);

  let currentBlock = firstBlock;
  let dataIndex = 0;
  let offset = VEC_DATA;

  while (dataIndex < length) {
    heap.memory.writeFloat(SEG_HEAP, currentBlock + offset, data[dataIndex]);
    offset += ELEMENT_SIZE;
    dataIndex++;

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
export function vectorGet(
  heap: Heap,
  vectorPtr: number,
  index: number
): number {
  const { value: firstBlock } = fromTaggedValue(vectorPtr);
  const length = heap.memory.read16(SEG_HEAP, firstBlock + VEC_SIZE);
  if (index < 0 || index >= length) return NIL;

  let currentBlock = firstBlock;
  let remainingIndex = index;

  while (currentBlock !== INVALID) {
    if (remainingIndex < capacityPerBlock) {
      return heap.memory.readFloat(
        SEG_HEAP,
        currentBlock + VEC_DATA + remainingIndex * ELEMENT_SIZE
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
export function vectorUpdate(
  heap: Heap,
  vectorPtr: number,
  index: number,
  value: number
): number {
  let { value: origFirstBlock } = fromTaggedValue(vectorPtr);
  let firstBlock = origFirstBlock;

  const length = heap.memory.read16(SEG_HEAP, firstBlock + VEC_SIZE);
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
      currentBlock + VEC_DATA + remainingIndex * ELEMENT_SIZE,
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
        currentBlock + VEC_DATA + remainingIndex * ELEMENT_SIZE,
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
