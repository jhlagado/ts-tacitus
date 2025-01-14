import { MEMORY_SIZE, HEAP, HEAP_SIZE, BLOCK_SIZE, NIL } from "./constants";
import { Memory, Heap } from "./types";

/**
 * Initializes memory with zeros.
 * @returns A Memory object.
 */
export function initMemory(): Memory {
  return new Array(MEMORY_SIZE).fill(0);
}

/**
 * Initializes the heap.
 * @param memory - The memory object.
 * @returns A Heap object.
 */
export function initHeap(memory: Memory): Heap {
  const heap: Heap = {
    start: HEAP,
    size: HEAP_SIZE / BLOCK_SIZE,
    freeList: HEAP,
  };

  for (let i = HEAP; i < HEAP + HEAP_SIZE; i += BLOCK_SIZE) {
    memory[i] = i + BLOCK_SIZE;
  }
  memory[HEAP + HEAP_SIZE - BLOCK_SIZE] = NIL;

  return heap;
}

/**
 * Allocates memory from the heap.
 * @param memory - The memory object.
 * @param heap - The heap object.
 * @param size - The size of the memory to allocate.
 * @returns The starting block index or NIL if allocation fails.
 */
export function malloc(memory: Memory, heap: Heap, size: number): number {
  if (size <= 0) return NIL;

  const numBlocks = Math.ceil(size / BLOCK_SIZE);
  let current = heap.freeList;
  let prev = NIL;
  let startBlock = current;
  let blocksFound = 0;

  while (current !== NIL && blocksFound < numBlocks) {
    blocksFound++;
    prev = current;
    current = memory[current];
  }

  if (blocksFound < numBlocks) {
    if (startBlock !== NIL) {
      memory[prev] = heap.freeList;
      heap.freeList = startBlock;
    }
    return NIL;
  }

  memory[prev] = NIL;
  heap.freeList = current;
  memory[startBlock + 1] = size;

  return startBlock;
}

/**
 * Frees memory back to the heap.
 * @param memory - The memory object.
 * @param heap - The heap object.
 * @param pointer - The starting block index to free.
 */
export function free(memory: Memory, heap: Heap, pointer: number): void {
  if (pointer === NIL) return;

  let current = pointer;
  const oldFreeListHead = heap.freeList;

  while (memory[current] !== NIL) {
    current = memory[current];
  }

  memory[current] = oldFreeListHead;
  heap.freeList = pointer;
}
