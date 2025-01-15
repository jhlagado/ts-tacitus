import { BLOCK_NEXT, BLOCK_SIZE, Heap } from "./heap";
import { NIL } from "./constants";

export const ARR_LEN = 1;
export const ARR_DATA = 2;

/**
 * Converts an array index into a heap memory index.
 * @param heap - The heap instance where the array is stored.
 * @param startBlock - The starting block index of the array.
 * @param index - The index of the element in the array.
 * @returns The heap memory index of the element, or NIL if the index is out of bounds.
 */
function arrayIndexToHeapIndex(
  heap: Heap,
  startBlock: number,
  index: number
): number {
  const length = arrayLength(heap, startBlock);
  if (index < 0 || index >= length) {
    return NIL; // Index out of bounds
  }

  let currentBlock = startBlock;
  let elementsTraversed = 0;

  while (currentBlock !== NIL) {
    const elementsInBlock = Math.min(
      BLOCK_SIZE - ARR_DATA,
      length - elementsTraversed
    );

    if (index < elementsTraversed + elementsInBlock) {
      // Calculate the position within the current block
      return currentBlock + ARR_DATA + (index - elementsTraversed);
    }

    // Move to the next block
    elementsTraversed += elementsInBlock;
    currentBlock = heap.memory[currentBlock + BLOCK_NEXT];
  }

  return NIL; // Should not reach here if the index is valid
}

/**
 * Allocates an array in the heap and initializes it with the given array.
 * @param heap - The heap instance to use for allocation.
 * @param array - The array to initialize the allocated array.
 * @returns The starting block index of the allocated array, or NIL if allocation fails.
 */
export function arrayCreate(heap: Heap, array: number[]): number {
  const length = array.length;
  const firstBlock = heap.malloc(BLOCK_SIZE); // Allocate the first block
  if (firstBlock === NIL) return NIL; // Allocation failed

  // Store the length at STR_LEN of the first block
  heap.memory[firstBlock + ARR_LEN] = length;

  let currentBlock = firstBlock;
  let arrayIndex = 0;

  // Write elements into the first block (starting from ARR_DATA)
  for (let i = ARR_DATA; i < BLOCK_SIZE && arrayIndex < length; i++) {
    heap.memory[currentBlock + i] = array[arrayIndex];
    arrayIndex++;
  }

  // If the array is longer than the first block, allocate additional blocks
  while (arrayIndex < length) {
    const nextBlock = heap.malloc(BLOCK_SIZE);
    if (nextBlock === NIL) {
      // Free all allocated blocks if allocation fails
      heap.free(firstBlock);
      return NIL;
    }
    heap.memory[currentBlock + BLOCK_NEXT] = nextBlock; // Link to the next block
    currentBlock = nextBlock;

    // Write elements into the current block (starting from ARR_DATA)
    for (let i = ARR_DATA; i < BLOCK_SIZE && arrayIndex < length; i++) {
      heap.memory[currentBlock + i] = array[arrayIndex];
      arrayIndex++;
    }
  }

  // Mark the end of the array
  heap.memory[currentBlock + BLOCK_NEXT] = NIL;

  return firstBlock;
}

/**
 * Returns the length of an array stored in the heap.
 * @param heap - The heap instance where the array is stored.
 * @param startBlock - The starting block index of the array.
 * @returns The length of the array.
 */
export function arrayLength(heap: Heap, startBlock: number): number {
  return heap.memory[startBlock + ARR_LEN]; // Length is stored at STR_LEN
}

/**
 * Reads an array from the heap and returns it as a JavaScript array.
 * @param heap - The heap instance where the array is stored.
 * @param startBlock - The starting block index of the array.
 * @returns The array as a JavaScript array.
 */
export function arrayRead(heap: Heap, startBlock: number): number[] {
  const result: number[] = [];
  let currentBlock = startBlock;
  const length = arrayLength(heap, startBlock);
  let elementsRead = 0;

  // Read elements from the first block (starting from ARR_DATA)
  for (let i = ARR_DATA; i < BLOCK_SIZE && elementsRead < length; i++) {
    result.push(heap.memory[currentBlock + i]);
    elementsRead++;
  }

  // Read elements from subsequent blocks
  currentBlock = heap.memory[currentBlock + BLOCK_NEXT]; // Move to the next block
  while (currentBlock !== NIL && elementsRead < length) {
    for (let i = ARR_DATA; i < BLOCK_SIZE && elementsRead < length; i++) {
      result.push(heap.memory[currentBlock + i]);
      elementsRead++;
    }
    currentBlock = heap.memory[currentBlock + BLOCK_NEXT]; // Move to the next block
  }

  return result;
}

/**
 * Prints an array stored in the heap to the console.
 * @param heap - The heap instance where the array is stored.
 * @param startBlock - The starting block index of the array.
 */
export function arrayPrint(heap: Heap, startBlock: number): void {
  console.log(arrayRead(heap, startBlock));
}

/**
 * Gets an element from the array stored in the heap.
 * @param heap - The heap instance where the array is stored.
 * @param startBlock - The starting block index of the array.
 * @param index - The index of the element to get.
 * @returns The element at the specified index, or undefined if the index is out of bounds.
 */
export function arrayGet(
  heap: Heap,
  startBlock: number,
  index: number
): number | undefined {
  const heapIndex = arrayIndexToHeapIndex(heap, startBlock, index);
  if (heapIndex === NIL) return undefined;
  return heap.memory[heapIndex];
}

/**
 * Updates an element in the array stored in the heap.
 * @param heap - The heap instance where the array is stored.
 * @param startBlock - The starting block index of the array.
 * @param index - The index of the element to update.
 * @param value - The new value to set.
 */
export function arrayUpdate(
  heap: Heap,
  startBlock: number,
  index: number,
  value: number
): void {
  const heapIndex = arrayIndexToHeapIndex(heap, startBlock, index);
  if (heapIndex === NIL) {
    throw new Error("Index out of bounds");
  }
  heap.memory[heapIndex] = value;
}
