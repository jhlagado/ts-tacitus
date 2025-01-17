import { BLOCK_NEXT, BLOCK_SIZE, Heap } from "./heap";
import { NIL } from "./constants";
import { Memory } from "./memory";

export const ARR_DIM = 2; // Offset for storing the number of dimensions (16-bit)
export const ARR_STRIDES = 4; // Offset for storing the strides (16-bit each)
export const ARR_DATA = 18; // Offset for storing the data (after the header)
export const MAX_DIMENSIONS = 7; // Maximum number of dimensions supported

/**
 * Allocates a multi-dimensional array in the heap.
 * @param heap - The Heap instance to use for allocation.
 * @param shape - The shape of the array (e.g., [2, 3] for a 2x3 array).
 * @param data - The flat array of values.
 * @returns The starting block index of the allocated array, or NIL if allocation fails.
 */
export function arrayCreate(
  heap: Heap,
  shape: number[],
  data: number[]
): number {
  const memory = heap.memory;
  const numDimensions = shape.length;

  // Validate the number of dimensions
  if (numDimensions > MAX_DIMENSIONS) {
    throw new Error(
      `Number of dimensions (${numDimensions}) exceeds maximum (${MAX_DIMENSIONS}).`
    );
  }

  // Calculate strides (skip the stride for the innermost dimension)
  const strides: number[] = [];
  let stride = 1;
  for (let i = numDimensions - 2; i >= 0; i--) {
    stride *= shape[i + 1]; // Multiply by the size of the next dimension
    strides.unshift(stride); // Prepend the stride
  }

  // Allocate the first block
  const firstBlock = heap.malloc(BLOCK_SIZE);
  if (firstBlock === NIL) return NIL; // Allocation failed

  // Store metadata in the header
  memory.write16(firstBlock + BLOCK_NEXT, NIL); // Initialize BLOCK_NEXT to NIL
  memory.write16(firstBlock + ARR_DIM, numDimensions); // Store number of dimensions
  for (let i = 0; i < numDimensions - 1; i++) {
    memory.write16(firstBlock + ARR_STRIDES + i * 2, strides[i]); // Store strides
  }

  let currentBlock = firstBlock;
  let dataIndex = 0;

  // Write data to the first block (starting at ARR_DATA)
  for (
    let i = ARR_DATA;
    i + 4 <= BLOCK_SIZE && dataIndex < data.length;
    i += 4
  ) {
    memory.writeFloat(currentBlock + i, data[dataIndex]); // Store Float32 (32-bit)
    dataIndex++;
  }

  // If the data exceeds the first block, allocate additional blocks
  while (dataIndex < data.length) {
    const nextBlock = heap.malloc(BLOCK_SIZE);
    if (nextBlock === NIL) {
      heap.free(firstBlock);
      return NIL; // Allocation failed
    }
    memory.write16(currentBlock + BLOCK_NEXT, nextBlock); // Link to the next block (16-bit)
    currentBlock = nextBlock;

    // Write data to the current block
    for (let i = 0; i + 4 <= BLOCK_SIZE && dataIndex < data.length; i += 4) {
      memory.writeFloat(currentBlock + i, data[dataIndex]); // Store Float32 (32-bit)
      dataIndex++;
    }
  }

  // Mark the end of the array
  memory.write16(currentBlock + BLOCK_NEXT, NIL); // End of array (16-bit)

  return firstBlock;
}

/**
 * Reads an element from a multi-dimensional array.
 * @param memory - The Memory instance where the heap resides.
 * @param startBlock - The starting block index of the array.
 * @param indices - The multi-dimensional indices.
 * @returns The element at the specified indices, or undefined if out of bounds.
 */
export function arrayGet(
  memory: Memory,
  startBlock: number,
  indices: number[]
): number | undefined {
  const numDimensions = memory.read16(startBlock + ARR_DIM); // Read number of dimensions

  // Validate the number of indices
  if (indices.length !== numDimensions) {
    throw new Error(
      `Expected ${numDimensions} indices, but got ${indices.length}.`
    );
  }

  // Read strides (only non-redundant strides are stored)
  const strides: number[] = [];
  for (let i = 0; i < numDimensions - 1; i++) {
    strides.push(memory.read16(startBlock + ARR_STRIDES + i * 2)); // Read strides
  }

  // Calculate flat index
  let flatIndex = indices[indices.length - 1]; // Start with the innermost index
  for (let i = 0; i < strides.length; i++) {
    flatIndex += indices[i] * strides[i]; // Add contributions from other dimensions
  }

  // Read the element
  const position = findArrayPosition(memory, startBlock, flatIndex);
  if (position === null) {
    return undefined; // Index is out of bounds
  }

  return memory.readFloat(position.block + position.offset); // Read Float32 (32-bit)
}

/**
 * Updates an element in a multi-dimensional array.
 * @param memory - The Memory instance where the heap resides.
 * @param startBlock - The starting block index of the array.
 * @param indices - The multi-dimensional indices.
 * @param value - The new value to set.
 */
export function arrayUpdate(
  memory: Memory,
  startBlock: number,
  indices: number[],
  value: number
): void {
  const numDimensions = memory.read16(startBlock + ARR_DIM); // Read number of dimensions

  // Validate the number of indices
  if (indices.length !== numDimensions) {
    throw new Error(
      `Expected ${numDimensions} indices, but got ${indices.length}.`
    );
  }

  // Read strides (only non-redundant strides are stored)
  const strides: number[] = [];
  for (let i = 0; i < numDimensions - 1; i++) {
    strides.push(memory.read16(startBlock + ARR_STRIDES + i * 2)); // Read strides
  }

  // Calculate flat index
  let flatIndex = indices[indices.length - 1]; // Start with the innermost index
  for (let i = 0; i < strides.length; i++) {
    flatIndex += indices[i] * strides[i]; // Add contributions from other dimensions
  }

  // Update the element
  const position = findArrayPosition(memory, startBlock, flatIndex);
  if (position === null) {
    throw new Error("Index out of bounds");
  }

  memory.writeFloat(position.block + position.offset, value); // Write Float32 (32-bit)
}

/**
 * Finds the block and offset for a given flat index.
 * @param memory - The Memory instance where the heap resides.
 * @param startBlock - The starting block index of the array.
 * @param flatIndex - The flat index of the element to find.
 * @returns An object containing the current block and offset, or `null` if the index is out of bounds.
 */
function findArrayPosition(
  memory: Memory,
  startBlock: number,
  flatIndex: number
): { block: number; offset: number } | null {
  let currentBlock = startBlock;
  let elementsRead = 0;

  while (currentBlock !== NIL) {
    // Calculate the number of elements in the current block
    const elementsInBlock = Math.floor((BLOCK_SIZE - ARR_DATA) / 4); // Each element is 4 bytes (Float32)

    // Check if the target index is in this block
    if (flatIndex < elementsRead + elementsInBlock) {
      const offset = ARR_DATA + (flatIndex - elementsRead) * 4; // Calculate the offset (32-bit aligned)
      return { block: currentBlock, offset };
    }

    // Move to the next block
    elementsRead += elementsInBlock;
    currentBlock = memory.read16(currentBlock + BLOCK_NEXT); // Read next block pointer (16-bit)
  }

  return null; // Index is out of bounds
}
