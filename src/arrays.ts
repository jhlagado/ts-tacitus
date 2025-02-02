import { BLOCK_NEXT, BLOCK_REFS, BLOCK_SIZE, Heap } from "./heap";
import { NIL } from "./constants";
import { TAG_ANY, Tag, fromTagNum } from "./tagnum";

export const MAX_DIMENSIONS = 6;
export const ARR_DIM = 4;
export const ARR_SHAPE = ARR_DIM + 2;
export const ARR_STRIDES = ARR_SHAPE + MAX_DIMENSIONS * 2;
export const ARR_DATA = ARR_STRIDES + MAX_DIMENSIONS * 2;
export const ARR_DATA2 = 4;

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

  // Calculate strides (excluding innermost dimension)
  const strides = Array.from({ length: numDimensions - 1 }, (_, i) =>
    shape.slice(i + 1).reduce((acc, size) => acc * size, 1)
  );

  // Allocate the first block with reference counting
  const firstBlock = heap.malloc(BLOCK_SIZE);
  if (firstBlock === NIL) return NIL;

  // Initialize header
  memory.write16(firstBlock + ARR_DIM, numDimensions);
  heap.setNextBlock(firstBlock, NIL);

  // Write shape and strides data
  let offset = ARR_SHAPE;
  for (const dim of shape) {
    memory.write16(firstBlock + offset, dim);
    offset += 2;
  }
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
      const nextBlock = heap.malloc(BLOCK_SIZE);
      if (nextBlock === NIL) {
        heap.free(firstBlock);
        return NIL;
      }
      heap.setNextBlock(currentBlock, nextBlock);
      currentBlock = nextBlock;
      dataOffset = ARR_DATA2;
    }

    const value = data[dataIndex];
    if (typeof value === "number") {
      memory.writeFloat(currentBlock + dataOffset, value);
    } else {
      // Handle array references
      const { pointer, tag } = fromTagNum(Tag.ARRAY, value);
      if (tag === Tag.ARRAY) heap.incrementRef(pointer);
    }

    dataOffset += 4;
    dataIndex++;
  }

  return firstBlock;
}

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

  // Calculate flat index
  const flatIndex = indices.reduce(
    (acc, idx, i) => acc + (i < strides.length ? idx * strides[i] : idx),
    0
  );

  // Traverse blocks to find the value
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
      return memory.readFloat(currentBlock + offset);
    }

    elementsRead += blockCapacity;
    currentBlock = memory.read16(currentBlock + BLOCK_NEXT);
  }

  return undefined;
}

export function arrayUpdate(
  heap: Heap,
  startBlock: number,
  indices: number[],
  value: number
): void {
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
  let currentBlock = startBlock;
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
        if (currentBlock === startBlock) startBlock = newBlock;
        currentBlock = newBlock;
      }

      const offset =
        currentBlock === startBlock
          ? ARR_DATA + (flatIndex - elementsRead) * 4
          : ARR_DATA2 + (flatIndex - elementsRead) * 4;

      // Handle reference counting for array values
      const oldValue = memory.readFloat(currentBlock + offset);
      if (isNaN(oldValue)) {
        const { tag, pointer } = fromTagNum(TAG_ANY, oldValue);
        if (tag === Tag.ARRAY) heap.decrementRef(pointer);
      }

      memory.writeFloat(currentBlock + offset, value);
      return;
    }

    elementsRead += blockCapacity;
    currentBlock = memory.read16(currentBlock + BLOCK_NEXT);
  }

  // If we reach here, the index is out of bounds
  throw new Error("Index out of bounds");
}

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
