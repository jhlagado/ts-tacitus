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

  if (numDimensions > MAX_DIMENSIONS) {
    throw new Error(
      `Number of dimensions (${numDimensions}) exceeds maximum (${MAX_DIMENSIONS}).`
    );
  }

  // Calculate strides (excluding innermost dimension)
  const strides: number[] = [];
  let stride = 1;
  for (let i = numDimensions - 2; i >= 0; i--) {
    stride *= shape[i + 1];
    strides.unshift(stride);
  }

  // Allocate first block with reference counting
  const firstBlock = heap.malloc(BLOCK_SIZE);
  if (firstBlock === NIL) return NIL;

  // Initialize header
  memory.write16(firstBlock + ARR_DIM, numDimensions);
  heap.setNextBlock(firstBlock, NIL);

  // Write shape data
  let offset = ARR_SHAPE;
  for (const dim of shape) {
    memory.write16(firstBlock + offset, dim);
    offset += 2;
  }

  // Write strides
  offset = ARR_STRIDES;
  for (const s of strides) {
    memory.write16(firstBlock + offset, s);
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

  if (indices.length !== numDimensions) {
    throw new Error(
      `Expected ${numDimensions} indices, got ${indices.length}.`
    );
  }

  // Calculate flat index
  const shape: number[] = [];
  for (let i = 0; i < numDimensions; i++) {
    shape.push(memory.read16(startBlock + ARR_SHAPE + i * 2));
  }

  const strides: number[] = [];
  for (let i = 0; i < numDimensions - 1; i++) {
    strides.push(memory.read16(startBlock + ARR_STRIDES + i * 2));
  }

  let flatIndex = indices[indices.length - 1];
  for (let i = 0; i < strides.length; i++) {
    flatIndex += indices[i] * strides[i];
  }

  // Traverse blocks with reference counting
  let currentBlock = startBlock;
  let elementsRead = 0;
  const elementsPerBlock = Math.floor((BLOCK_SIZE - ARR_DATA) / 4);

  while (currentBlock !== NIL) {
    const blockCapacity =
      currentBlock === startBlock
        ? elementsPerBlock
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
  const shape: number[] = [];
  for (let i = 0; i < numDimensions; i++) {
    const dimSize = memory.read16(startBlock + ARR_SHAPE + i * 2);
    shape.push(dimSize);
    if (indices[i] < 0 || indices[i] >= dimSize) {
      throw new Error("Index out of bounds");
    }
  }

  // Calculate strides (excluding innermost dimension)
  const strides: number[] = [];
  let stride = 1;
  for (let i = numDimensions - 2; i >= 0; i--) {
    stride *= shape[i + 1];
    strides.unshift(stride);
  }

  // Compute flat index
  let flatIndex = indices[indices.length - 1];
  for (let i = 0; i < strides.length; i++) {
    flatIndex += indices[i] * strides[i];
  }

  // Traverse blocks with reference counting
  let currentBlock = startBlock;
  let elementsRead = 0;
  const elementsPerBlock = Math.floor((BLOCK_SIZE - ARR_DATA) / 4);
  while (currentBlock !== NIL) {
    const blockCapacity =
      currentBlock === startBlock
        ? elementsPerBlock
        : Math.floor((BLOCK_SIZE - ARR_DATA2) / 4);
    if (flatIndex < elementsRead + blockCapacity) {
      // Check if we need to clone the block
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
