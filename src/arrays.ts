import { BLOCK_NEXT, BLOCK_SIZE, Heap } from "./heap";
import { NIL } from "./constants";
import { Memory } from "./memory";

export const ARR_LEN = 2; // Offset for storing the array length (16-bit)
export const ARR_DATA = 4; // Offset for storing the array data (16-bit)

/**
 * Finds the block and offset for a given array index.
 * @param memory - The Memory instance where the heap resides.
 * @param startBlock - The starting block index of the array.
 * @param index - The index of the array element to find.
 * @returns An object containing the current block and offset, or `null` if the index is out of bounds.
 */
export function findArrayPosition(
  memory: Memory,
  startBlock: number,
  index: number
): { block: number; offset: number } | null {
  let currentBlock = startBlock;
  const length = memory.read16(currentBlock + ARR_LEN); // Read array length (16-bit)

  // Check if the index is out of bounds
  if (index < 0 || index >= length) {
    return null;
  }

  let elementsRead = 0;

  while (currentBlock !== NIL && elementsRead <= index) {
    // Calculate the number of elements in the current block
    const elementsInBlock = Math.min(
      Math.floor((BLOCK_SIZE - ARR_DATA) / 4), // Each element is 4 bytes (Float32)
      length - elementsRead
    );

    // Check if the target index is in this block
    if (index < elementsRead + elementsInBlock) {
      const offset = ARR_DATA + (index - elementsRead) * 4; // Calculate the offset (32-bit aligned)
      return { block: currentBlock, offset };
    }

    // Move to the next block
    elementsRead += elementsInBlock;
    currentBlock = memory.read16(currentBlock + BLOCK_NEXT); // Read next block pointer (16-bit)
  }

  return null; // Index is out of bounds
}

/**
 * Allocates an array in the heap and initializes it with the given array.
 * @param heap - The Heap instance to use for allocation.
 * @param array - The array to initialize the allocated array.
 * @returns The starting block index of the allocated array, or NIL if allocation fails.
 */
export function arrayCreate(heap: Heap, array: number[]): number {
  const memory = heap.memory;
  const length = array.length;
  const firstBlock = heap.malloc(BLOCK_SIZE); // Allocate the first block
  if (firstBlock === NIL) return NIL; // Allocation failed

  // Store the length at ARR_LEN of the first block (16-bit)
  memory.write16(firstBlock + ARR_LEN, length);

  let currentBlock = firstBlock;
  let arrayIndex = 0;

  // Write elements to the first block (32-bit Float32)
  for (let i = ARR_DATA; i + 4 <= BLOCK_SIZE && arrayIndex < length; i += 4) {
    memory.writeFloat(currentBlock + i, array[arrayIndex]);
    arrayIndex++;
  }

  // If the array exceeds the first block, allocate additional blocks
  while (arrayIndex < length) {
    const nextBlock = heap.malloc(BLOCK_SIZE);
    if (nextBlock === NIL) {
      heap.free(firstBlock);
      return NIL; // Allocation failed
    }
    memory.write16(currentBlock + BLOCK_NEXT, nextBlock); // Link to the next block (16-bit)
    currentBlock = nextBlock;

    // Write elements to the current block (32-bit Float32)
    for (let i = ARR_DATA; i + 4 <= BLOCK_SIZE && arrayIndex < length; i += 4) {
      memory.writeFloat(currentBlock + i, array[arrayIndex]);
      arrayIndex++;
    }
  }

  // Mark the end of the array
  memory.write16(currentBlock + BLOCK_NEXT, NIL); // End of array (16-bit)

  return firstBlock;
}

/**
 * Reads an array from the heap and returns it as a JavaScript array.
 * @param memory - The Memory instance where the heap resides.
 * @param startBlock - The starting block index of the array.
 * @returns The array as a JavaScript array.
 */
export function arrayRead(memory: Memory, startBlock: number): number[] {
  return Array.from(iterateArray(memory, startBlock));
}

/**
 * Iterates over the elements of an array stored in the heap.
 * @param memory - The Memory instance where the heap resides.
 * @param startBlock - The starting block index of the array.
 * @yields The next element in the array.
 */
export function* iterateArray(
  memory: Memory,
  startBlock: number
): Generator<number, void, void> {
  let currentBlock = startBlock;
  const length = memory.read16(currentBlock + ARR_LEN); // Read array length (16-bit)
  let elementsRead = 0;

  while (currentBlock !== NIL && elementsRead < length) {
    for (
      let i = ARR_DATA; // Data starts at ARR_DATA (16-bit aligned)
      i + 4 <= BLOCK_SIZE && elementsRead < length;
      i += 4
    ) {
      yield memory.readFloat(currentBlock + i); // Read element (32-bit Float32)
      elementsRead++;
    }

    // Move to the next block
    currentBlock = memory.read16(currentBlock + BLOCK_NEXT); // Read next block pointer (16-bit)
  }
}

/**
 * Gets an element from the array stored in the heap.
 * @param memory - The Memory instance where the heap resides.
 * @param startBlock - The starting block index of the array.
 * @param index - The index of the element to get.
 * @returns The element at the specified index, or undefined if the index is out of bounds.
 */
export function arrayGet(
  memory: Memory,
  startBlock: number,
  index: number
): number | undefined {
  const position = findArrayPosition(memory, startBlock, index);
  if (position === null) {
    return undefined; // Index is out of bounds
  }

  return memory.readFloat(position.block + position.offset); // Read element (32-bit Float32)
}

/**
 * Updates an element in the array stored in the heap.
 * @param memory - The Memory instance where the heap resides.
 * @param startBlock - The starting block index of the array.
 * @param index - The index of the element to update.
 * @param value - The new value to set.
 */
export function arrayUpdate(
  memory: Memory,
  startBlock: number,
  index: number,
  value: number
): void {
  const position = findArrayPosition(memory, startBlock, index);
  if (position === null) {
    throw new Error("Index out of bounds");
  }

  // Write the new element to memory (32-bit Float32)
  memory.writeFloat(position.block + position.offset, value);
}

/**
 * Returns the length of an array stored in the heap.
 * @param memory - The Memory instance where the heap resides.
 * @param startBlock - The starting block index of the array.
 * @returns The length of the array.
 */
export function arrayLength(memory: Memory, startBlock: number): number {
  return memory.read16(startBlock + ARR_LEN); // Read array length (16-bit)
}

/**
 * Prints an array stored in the heap to the console.
 * @param memory - The Memory instance where the heap resides.
 * @param startBlock - The starting block index of the array.
 */
/**
 * Prints an array stored in the heap to the console.
 * @param memory - The Memory instance where the heap resides.
 * @param startBlock - The starting block index of the array.
 */
export function arrayPrint(memory: Memory, startBlock: number): void {
  const arr = arrayRead(memory, startBlock);

  // Round each element to 5 decimal places
  const roundedArr = arr.map((value) => parseFloat(value.toFixed(5)));
  console.log(roundedArr);
}
