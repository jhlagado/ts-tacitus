import { BLOCK_NEXT, BLOCK_REFS, BLOCK_SIZE, Heap } from "./heap";
import { NIL } from "./constants";
import { TAG_ANY, TAG_NAN, isTagNum, fromTagNum, Tag } from "./tagnum";

// Constants for array layout in memory
export const MAX_DIMENSIONS = 6; // Maximum number of dimensions allowed
export const ARR_DIM = 4; // Offset for the number of dimensions (2 bytes)
export const ARR_SHAPE = ARR_DIM + 2; // Offset for the shape data (2 bytes per dimension)
export const ARR_STRIDES = ARR_SHAPE + MAX_DIMENSIONS * 2; // Offset for strides data (2 bytes per stride)
export const ARR_DATA = ARR_STRIDES + MAX_DIMENSIONS * 2; // Offset for array data in the first block
export const ARR_DATA2 = 4; // Offset for array data in subsequent blocks

/**
 * Creates a new array with the given shape and initializes it with the provided data.
 * @param heap - The heap instance managing memory.
 * @param shape - The shape of the array (e.g., [3, 3] for a 3x3 array).
 * @param data - The data to populate the array with.
 * @returns The pointer to the first block of the newly created array.
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

  // Calculate total size needed for the array
  const totalElements = shape.reduce((acc, dim) => acc * dim, 1);

  // Validate that the heap has enough memory
  const firstBlockCapacity = Math.floor((BLOCK_SIZE - ARR_DATA) / 4);
  const subsequentBlockCapacity = Math.floor((BLOCK_SIZE - ARR_DATA2) / 4);
  let requiredBlocks = 1;
  let remainingElements = totalElements - firstBlockCapacity;
  while (remainingElements > 0) {
    requiredBlocks++;
    remainingElements -= subsequentBlockCapacity;
  }

  let availableBlocks = 0;
  let current = heap.freeList;
  while (current !== NIL) {
    availableBlocks++;
    current = memory.read16(current + BLOCK_NEXT);
  }
  if (availableBlocks < requiredBlocks) {
    return NIL; // Not enough memory to allocate the array
  }

  // Allocate blocks using malloc
  const allocatedBytes = requiredBlocks * BLOCK_SIZE; // Use BLOCK_SIZE instead of USABLE_BLOCK_SIZE
  const firstBlock = heap.malloc(allocatedBytes);
  if (firstBlock === NIL) return NIL;

  // Initialize header
  memory.write16(firstBlock + ARR_DIM, numDimensions);

  // Write shape data
  let offset = ARR_SHAPE;
  for (const dim of shape) {
    memory.write16(firstBlock + offset, dim);
    offset += 2;
  }

  // Calculate strides (excluding innermost dimension)
  const strides = Array.from({ length: numDimensions - 1 }, (_, i) =>
    shape.slice(i + 1).reduce((acc, size) => acc * size, 1)
  );

  // Write strides data
  offset = ARR_STRIDES;
  for (const stride of strides) {
    memory.write16(firstBlock + offset, stride);
    offset += 2;
  }

  // Write data with copy-on-write awareness
  let currentBlock = firstBlock;
  let dataIndex = 0;
  let dataOffset = ARR_DATA;

  while (dataIndex < data.length) {
    if (dataOffset + 4 > BLOCK_SIZE) {
      // Move to the next block using getNextBlock
      currentBlock = heap.getNextBlock(currentBlock);
      if (currentBlock === NIL) {
        throw new Error("Unexpected end of allocated blocks.");
      }
      dataOffset = ARR_DATA2;
    }

    const value = data[dataIndex];
    if (isTagNum(value)) {
      const { tag, pointer } = fromTagNum(TAG_ANY, value);
      if (tag === Tag.ARRAY) heap.incrementRef(pointer); // Increment reference count for ARRAY tags
    }
    memory.writeFloat(currentBlock + dataOffset, value);

    dataOffset += 4;
    dataIndex++;
  }

  return firstBlock;
}

/**
 * Retrieves the value at the specified indices in the array.
 * @param heap - The heap instance managing memory.
 * @param startBlock - The pointer to the first block of the array.
 * @param indices - The indices specifying the position in the array.
 * @returns The value at the specified position, or undefined if out of bounds.
 */
export function arrayGet(
  heap: Heap,
  startBlock: number,
  indices: number[]
): number | undefined {
  const memory = heap.memory;
  const numDimensions = memory.read16(startBlock + ARR_DIM);

  // Validate indices length
  if (indices.length !== numDimensions) {
    throw new Error(
      `Expected ${numDimensions} indices, got ${indices.length}.`
    );
  }

  // Extract strides
  const strides = Array.from({ length: numDimensions - 1 }, (_, i) =>
    memory.read16(startBlock + ARR_STRIDES + i * 2)
  );

  // Compute flat index
  const flatIndex = indices.reduce(
    (acc, idx, i) => acc + (i < strides.length ? idx * strides[i] : idx),
    0
  );

  // Find the block and offset for the flat index
  const { block: currentBlock, offset } = findBlockAndOffset(
    heap,
    startBlock,
    flatIndex
  );

  // Read and return the value
  return memory.readFloat(currentBlock + offset);
}

/**
 * Updates the value at the specified indices in the array.
 * @param heap - The heap instance managing memory.
 * @param startBlock - The pointer to the first block of the array.
 * @param indices - The indices specifying the position in the array.
 * @param value - The new value to assign.
 */
export function arrayUpdate(
  heap: Heap,
  startBlock: number,
  indices: number[],
  value: number
): number {
  const memory = heap.memory;
  const numDimensions = memory.read16(startBlock + ARR_DIM);

  // Validate the number of indices
  if (indices.length !== numDimensions) {
    throw new Error(
      `Expected ${numDimensions} indices, got ${indices.length}.`
    );
  }

  // Read shape and validate bounds for each index
  const shape = Array.from({ length: numDimensions }, (_, i) => {
    const dimSize = memory.read16(startBlock + ARR_SHAPE + i * 2);
    if (indices[i] < 0 || indices[i] >= dimSize) {
      throw new Error("Index out of bounds");
    }
    return dimSize;
  });

  // Calculate strides (excluding innermost dimension)
  const strides = Array.from({ length: numDimensions - 1 }, (_, i) =>
    shape.slice(i + 1).reduce((acc, size) => acc * size, 1)
  );

  // Compute flat index
  const flatIndex = indices.reduce(
    (acc, idx, i) => acc + (i < strides.length ? idx * strides[i] : idx),
    0
  );

  // Traverse blocks with reference counting
  let currentBlock = startBlock; // Use 'let' instead of 'const'
  let elementsRead = 0;

  while (currentBlock !== NIL) {
    const blockCapacity =
      currentBlock === startBlock
        ? Math.floor((BLOCK_SIZE - ARR_DATA) / 4)
        : Math.floor((BLOCK_SIZE - ARR_DATA2) / 4);

    if (flatIndex < elementsRead + blockCapacity) {
      // Clone block if necessary
      if (memory.read16(currentBlock + BLOCK_REFS) > 1) {
        const newBlock = cloneBlock(heap, currentBlock);
        if (currentBlock === startBlock) {
          startBlock = newBlock;
        }
        currentBlock = newBlock; // Reassigning currentBlock
      }

      const offset =
        currentBlock === startBlock
          ? ARR_DATA + (flatIndex - elementsRead) * 4
          : ARR_DATA2 + (flatIndex - elementsRead) * 4;

      // Handle reference counting for the old value
      const oldValue = memory.readFloat(currentBlock + offset);
      if (isTagNum(oldValue)) {
        const { tag, pointer } = fromTagNum(TAG_ANY, oldValue);
        if (tag !== TAG_NAN) heap.decrementRef(pointer); // Only decrement if tag > 0
      }

      // Handle reference counting for the new value
      if (isTagNum(value)) {
        const { tag, pointer } = fromTagNum(TAG_ANY, value);
        if (tag !== TAG_NAN) heap.incrementRef(pointer); // Only increment if tag > 0
      }

      memory.writeFloat(currentBlock + offset, value);
      
      return startBlock; // Return potentially new startBlock
    }

    elementsRead += blockCapacity;
    currentBlock = heap.getNextBlock(currentBlock); // Reassigning currentBlock
  }

  // If we reach here, the index is out of bounds
  throw new Error("Index out of bounds");
}

/**
 * Helper function to find the block and offset for a given flat index.
 * @param heap - The heap instance managing memory.
 * @param startBlock - The pointer to the first block of the array.
 * @param flatIndex - The flat index to locate.
 * @returns An object containing the block and offset for the flat index.
 */
function findBlockAndOffset(
  heap: Heap,
  startBlock: number,
  flatIndex: number
): { block: number; offset: number } {
  let currentBlock = startBlock;
  let elementsRead = 0;

  while (currentBlock !== NIL) {
    const blockCapacity =
      currentBlock === startBlock
        ? Math.floor((BLOCK_SIZE - ARR_DATA) / 4)
        : Math.floor((BLOCK_SIZE - ARR_DATA2) / 4);

    if (flatIndex < elementsRead + blockCapacity) {
      const offset =
        currentBlock === startBlock
          ? ARR_DATA + (flatIndex - elementsRead) * 4
          : ARR_DATA2 + (flatIndex - elementsRead) * 4;
      return { block: currentBlock, offset };
    }

    elementsRead += blockCapacity;
    currentBlock = heap.getNextBlock(currentBlock);
  }

  throw new Error("Index out of bounds");
}

/**
 * Clones a block and its contents.
 * @param heap - The heap instance managing memory.
 * @param block - The block to clone.
 * @returns The pointer to the newly cloned block.
 */
function cloneBlock(heap: Heap, block: number): number {
  const newBlock = heap.malloc(BLOCK_SIZE);
  if (newBlock === NIL) throw new Error("Out of memory");

  // Copy block contents
  heap.memory.buffer.copyWithin(newBlock, block, block + BLOCK_SIZE);

  // Update reference counts
  heap.memory.write16(newBlock + BLOCK_REFS, 1);

  // Handle child blocks
  const nextBlock = heap.memory.read16(block + BLOCK_NEXT);
  if (nextBlock !== NIL) heap.incrementRef(nextBlock);

  return newBlock;
}
