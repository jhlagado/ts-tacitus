import { BLOCK_NEXT, BLOCK_SIZE, Heap } from "./heap";
import { NIL } from "./constants";

export const ARR_LEN = 1;
export const ARR_DATA = 2;

/**
 * Iterates over the elements of an array stored in the heap.
 * @param heap - The heap instance where the array is stored.
 * @param startBlock - The starting block index of the array.
 * @yields The next element in the array.
 */
export function* iterateArray(
  heap: Heap,
  startBlock: number
): Generator<number, void, void> {
  let currentBlock = startBlock;
  const length = heap.memory[startBlock + ARR_LEN]; // Length is stored at ARR_LEN
  let elementsRead = 0;

  while (currentBlock !== NIL && elementsRead < length) {
    // Read elements from the current block
    for (
      let i = ARR_DATA; // Data starts at ARR_DATA
      i < BLOCK_SIZE && elementsRead < length;
      i++
    ) {
      yield heap.memory[currentBlock + i];
      elementsRead++;
    }

    // Move to the next block
    currentBlock = heap.memory[currentBlock + BLOCK_NEXT]; // Next block pointer is at BLOCK_NEXT
  }
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

  // Store the length at ARR_LEN of the first block
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
 * Reads an array from the heap and returns it as a JavaScript array.
 * @param heap - The heap instance where the array is stored.
 * @param startBlock - The starting block index of the array.
 * @returns The array as a JavaScript array.
 */
export function arrayRead(heap: Heap, startBlock: number): number[] {
  return Array.from(iterateArray(heap, startBlock));
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
 * Returns the length of an array stored in the heap.
 * @param heap - The heap instance where the array is stored.
 * @param startBlock - The starting block index of the array.
 * @returns The length of the array.
 */
export function arrayLength(heap: Heap, startBlock: number): number {
  return heap.memory[startBlock + ARR_LEN]; // Length is stored at ARR_LEN
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
  const iterator = iterateArray(heap, startBlock);
  let currentIndex = 0;
  for (const element of iterator) {
    if (currentIndex === index) {
      return element;
    }
    currentIndex++;
  }
  return undefined; // Index out of bounds
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
  const iterator = iterateArray(heap, startBlock);
  let currentIndex = 0;
  let next = iterator.next();

  while (!next.done) {
    if (currentIndex === index) {
      heap.memory[startBlock + ARR_DATA + index] = value;
      return;
    }
    currentIndex++;
    next = iterator.next();
  }

  throw new Error("Index out of bounds");
}
