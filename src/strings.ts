import { BLOCK_NEXT, BLOCK_SIZE, Heap } from "./heap";
import { NIL } from "./constants";
import { Memory } from "./memory";

export const STR_LEN = 2; // Offset for storing the string length (16-bit)
export const STR_DATA = 4; // Offset for storing the string data (16-bit)

/**
 * Returns the length of a string stored in the heap.
 * @param memory - The Memory instance where the heap resides.
 * @param startBlock - The starting block index of the string.
 * @returns The length of the string.
 */
export function stringLength(memory: Memory, startBlock: number): number {
  return memory.read16(startBlock + STR_LEN); // Read string length (16-bit)
}

/**
 * Prints a string stored in the heap to the console.
 * @param memory - The Memory instance where the heap resides.
 * @param startBlock - The starting block index of the string.
 */
export function stringPrint(memory: Memory, startBlock: number): void {
  console.log(stringRead(memory, startBlock));
}

/**
 * Finds the block and offset for a given string index.
 * @param memory - The Memory instance where the heap resides.
 * @param startBlock - The starting block index of the string.
 * @param index - The index of the character to find.
 * @returns An object containing the current block and offset, or `null` if the index is out of bounds.
 */
export function findStringPosition(
  memory: Memory,
  startBlock: number,
  index: number
): { block: number; offset: number } | null {
  let currentBlock = startBlock;
  const length = memory.read16(currentBlock + STR_LEN); // Read string length (16-bit)

  // Check if the index is out of bounds
  if (index < 0 || index >= length) {
    return null;
  }

  let charsRead = 0;

  while (currentBlock !== NIL && charsRead <= index) {
    // Calculate the number of characters in the current block
    const charsInBlock = Math.min(BLOCK_SIZE - STR_DATA, length - charsRead);

    // Check if the target index is in this block
    if (index < charsRead + charsInBlock) {
      const offset = STR_DATA + (index - charsRead); // Calculate the offset (16-bit aligned)
      return { block: currentBlock, offset };
    }

    // Move to the next block
    charsRead += charsInBlock;
    currentBlock = memory.read16(currentBlock + BLOCK_NEXT); // Read next block pointer (16-bit)
  }

  return null; // Index is out of bounds
}

/**
 * Allocates a string in the heap and initializes it with the given string.
 * @param heap - The Heap instance to use for allocation.
 * @param str - The string to initialize the allocated string.
 * @returns The starting block index of the allocated string, or NIL if allocation fails.
 */
export function stringCreate(heap: Heap, str: string): number {
  const memory = heap.memory;
  const length = str.length;
  const firstBlock = heap.malloc(BLOCK_SIZE); // Allocate the first block
  if (firstBlock === NIL) return NIL; // Allocation failed

  // Store the length at STR_LEN of the first block (16-bit)
  memory.write16(firstBlock + STR_LEN, length);

  let currentBlock = firstBlock;
  let strIndex = 0;

  // Write characters to the first block (8-bit ASCII)
  for (let i = STR_DATA; i < BLOCK_SIZE && strIndex < length; i++) {
    memory.write8(currentBlock + i, str.charCodeAt(strIndex));
    strIndex++;
  }

  // If the string exceeds the first block, allocate additional blocks
  while (strIndex < length) {
    const nextBlock = heap.malloc(BLOCK_SIZE);
    if (nextBlock === NIL) {
      heap.free(firstBlock);
      return NIL; // Allocation failed
    }
    memory.write16(currentBlock + BLOCK_NEXT, nextBlock); // Link to the next block (16-bit)
    currentBlock = nextBlock;

    // Write characters to the current block (8-bit ASCII)
    for (let i = STR_DATA; i < BLOCK_SIZE && strIndex < length; i++) {
      memory.write8(currentBlock + i, str.charCodeAt(strIndex));
      strIndex++;
    }
  }

  // Mark the end of the string
  memory.write16(currentBlock + BLOCK_NEXT, NIL); // End of string (16-bit)

  return firstBlock;
}

/**
 * Reads a string from the heap and returns it as a JavaScript string.
 * @param memory - The Memory instance where the heap resides.
 * @param startBlock - The starting block index of the string.
 * @returns The string as a JavaScript string.
 */
export function stringRead(memory: Memory, startBlock: number): string {
  return Array.from(iterateString(memory, startBlock)).join("");
}

/**
 * Iterates over the characters of a string stored in the heap.
 * @param memory - The Memory instance where the heap resides.
 * @param startBlock - The starting block index of the string.
 * @yields The next character in the string.
 */
export function* iterateString(
  memory: Memory,
  startBlock: number
): Generator<string, void, void> {
  let currentBlock = startBlock;
  const length = memory.read16(currentBlock + STR_LEN); // Read string length (16-bit)
  let charsRead = 0;

  while (currentBlock !== NIL && charsRead < length) {
    for (
      let i = STR_DATA; // Data starts at STR_DATA (16-bit aligned)
      i < BLOCK_SIZE && charsRead < length;
      i++
    ) {
      const charCode = memory.read8(currentBlock + i); // Read character (8-bit ASCII)
      yield String.fromCharCode(charCode);
      charsRead++;
    }

    // Move to the next block
    currentBlock = memory.read16(currentBlock + BLOCK_NEXT); // Read next block pointer (16-bit)
  }
}

/**
 * Gets a character from the string stored in the heap.
 * @param memory - The Memory instance where the heap resides.
 * @param startBlock - The starting block index of the string.
 * @param index - The index of the character to get.
 * @returns The character at the specified index, or undefined if the index is out of bounds.
 */
export function stringGet(
  memory: Memory,
  startBlock: number,
  index: number
): string | undefined {
  const position = findStringPosition(memory, startBlock, index);
  if (position === null) {
    return undefined; // Index is out of bounds
  }

  const charCode = memory.read8(position.block + position.offset); // Read character (8-bit ASCII)
  return String.fromCharCode(charCode);
}

/**
 * Updates a character in the string stored in the heap.
 * @param memory - The Memory instance where the heap resides.
 * @param startBlock - The starting block index of the string.
 * @param index - The index of the character to update.
 * @param value - The new character to set.
 */
export function stringUpdate(
  memory: Memory,
  startBlock: number,
  index: number,
  value: string
): void {
  const position = findStringPosition(memory, startBlock, index);
  if (position === null) {
    throw new Error("Index out of bounds");
  }

  // Write the new character to memory (8-bit ASCII)
  memory.write8(position.block + position.offset, value.charCodeAt(0));
}