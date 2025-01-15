import { BLOCK_NEXT, BLOCK_SIZE, Heap } from "./heap";
import { NIL } from "./constants";

export const STR_LEN = 1; // Index 1: Length of the string
export const STR_DATA = 2; // Index 2: Start of string data

/**
 * Allocates a string in the heap and initializes it with the given string.
 * @param heap - The heap instance to use for allocation.
 * @param str - The string to initialize the allocated string.
 * @returns The starting block index of the allocated string, or NIL if allocation fails.
 */
export function stringCreate(heap: Heap, str: string): number {
  const length = str.length;
  const firstBlock = heap.malloc(BLOCK_SIZE); // Allocate the first block
  if (firstBlock === NIL) return NIL; // Allocation failed

  // Store the length at STR_LEN of the first block
  heap.memory[firstBlock + STR_LEN] = length;

  let currentBlock = firstBlock;
  let strIndex = 0;

  // Write characters into the first block (starting from STR_DATA)
  for (let i = STR_DATA; i < BLOCK_SIZE && strIndex < length; i++) {
    heap.memory[currentBlock + i] = str.charCodeAt(strIndex);
    strIndex++;
  }

  // If the string is longer than the first block, allocate additional blocks
  while (strIndex < length) {
    const nextBlock = heap.malloc(BLOCK_SIZE);
    if (nextBlock === NIL) {
      // Free all allocated blocks if allocation fails
      heap.free(firstBlock);
      return NIL;
    }
    heap.memory[currentBlock + BLOCK_NEXT] = nextBlock; // Link to the next block
    currentBlock = nextBlock;

    // Write characters into the current block (starting from STR_DATA)
    for (let i = STR_DATA; i < BLOCK_SIZE && strIndex < length; i++) {
      heap.memory[currentBlock + i] = str.charCodeAt(strIndex);
      strIndex++;
    }
  }

  // Mark the end of the string
  heap.memory[currentBlock + BLOCK_NEXT] = NIL;

  return firstBlock;
}

/**
 * Returns the length of a string stored in the heap.
 * @param heap - The heap instance where the string is stored.
 * @param startBlock - The starting block index of the string.
 * @returns The length of the string.
 */
export function stringLength(heap: Heap, startBlock: number): number {
  return heap.memory[startBlock + STR_LEN]; // Length is stored at STR_LEN
}

/**
 * Reads a string from the heap and returns it as a JavaScript string.
 * @param heap - The heap instance where the string is stored.
 * @param startBlock - The starting block index of the string.
 * @returns The string as a JavaScript string.
 */
export function stringRead(heap: Heap, startBlock: number): string {
  let result = "";
  let currentBlock = startBlock;
  const length = stringLength(heap, startBlock);
  let charsRead = 0;

  // Read characters from the first block (starting from STR_DATA)
  for (let i = STR_DATA; i < BLOCK_SIZE && charsRead < length; i++) {
    result += String.fromCharCode(heap.memory[currentBlock + i]);
    charsRead++;
  }

  // Read characters from subsequent blocks
  currentBlock = heap.memory[currentBlock + BLOCK_NEXT]; // Move to the next block
  while (currentBlock !== NIL && charsRead < length) {
    for (let i = STR_DATA; i < BLOCK_SIZE && charsRead < length; i++) {
      result += String.fromCharCode(heap.memory[currentBlock + i]);
      charsRead++;
    }
    currentBlock = heap.memory[currentBlock + BLOCK_NEXT]; // Move to the next block
  }

  return result;
}

/**
 * Prints a string stored in the heap to the console.
 * @param heap - The heap instance where the string is stored.
 * @param startBlock - The starting block index of the string.
 */
export function stringPrint(heap: Heap, startBlock: number): void {
  console.log(stringRead(heap, startBlock));
}
