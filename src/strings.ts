import { BLOCK_NEXT, BLOCK_SIZE, Heap } from "./heap";
import { NIL } from "./constants";

export const STR_LEN = 1;
export const STR_DATA = 2;

/**
 * Iterates over the characters of a string stored in the heap.
 * @param heap - The heap instance where the string is stored.
 * @param startBlock - The starting block index of the string.
 * @yields The next character in the string.
 */
export function* iterateString(
  heap: Heap,
  startBlock: number
): Generator<string, void, void> {
  let currentBlock = startBlock;
  const length = heap.memory[startBlock + STR_LEN]; // Length is stored at STR_LEN
  let charsRead = 0;

  while (currentBlock !== NIL && charsRead < length) {
    // Read characters from the current block
    for (
      let i = STR_DATA; // Data starts at STR_DATA
      i < BLOCK_SIZE && charsRead < length;
      i++
    ) {
      yield String.fromCharCode(heap.memory[currentBlock + i]);
      charsRead++;
    }

    // Move to the next block
    currentBlock = heap.memory[currentBlock + BLOCK_NEXT]; // Next block pointer is at BLOCK_NEXT
  }
}

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
 * Reads a string from the heap and returns it as a JavaScript string.
 * @param heap - The heap instance where the string is stored.
 * @param startBlock - The starting block index of the string.
 * @returns The string as a JavaScript string.
 */
export function stringRead(heap: Heap, startBlock: number): string {
  return Array.from(iterateString(heap, startBlock)).join("");
}

/**
 * Prints a string stored in the heap to the console.
 * @param heap - The heap instance where the string is stored.
 * @param startBlock - The starting block index of the string.
 */
export function stringPrint(heap: Heap, startBlock: number): void {
  console.log(stringRead(heap, startBlock));
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
 * Gets a character from the string stored in the heap.
 * @param heap - The heap instance where the string is stored.
 * @param startBlock - The starting block index of the string.
 * @param index - The index of the character to get.
 * @returns The character at the specified index, or undefined if the index is out of bounds.
 */
export function stringGet(
  heap: Heap,
  startBlock: number,
  index: number
): string | undefined {
  const iterator = iterateString(heap, startBlock);
  let currentIndex = 0;
  for (const char of iterator) {
    if (currentIndex === index) {
      return char;
    }
    currentIndex++;
  }
  return undefined; // Index out of bounds
}

/**
 * Updates a character in the string stored in the heap.
 * @param heap - The heap instance where the string is stored.
 * @param startBlock - The starting block index of the string.
 * @param index - The index of the character to update.
 * @param value - The new character to set.
 */
export function stringUpdate(
  heap: Heap,
  startBlock: number,
  index: number,
  value: string
): void {
  const iterator = iterateString(heap, startBlock);
  let currentIndex = 0;
  let next = iterator.next();

  while (!next.done) {
    if (currentIndex === index) {
      heap.memory[startBlock + STR_DATA + index] = value.charCodeAt(0);
      return;
    }
    currentIndex++;
    next = iterator.next();
  }

  throw new Error("Index out of bounds");
}
