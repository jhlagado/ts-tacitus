import { HEAP, HEAP_SIZE, NIL, BLOCK_SIZE, BLOCK_NEXT } from "./constants";

export class Heap {
  memory: number[];
  freeList: number;

  constructor(memory: number[]) {
    this.memory = memory;
    this.freeList = HEAP;
    this.initializeFreeList();
  }

  /**
   * Initializes the free list for the heap.
   */
  private initializeFreeList(): void {
    for (let i = HEAP; i < HEAP + HEAP_SIZE; i += BLOCK_SIZE) {
      this.memory[i + BLOCK_NEXT] = i + BLOCK_SIZE; // Use BLOCK_NEXT for the next pointer
    }
    this.memory[HEAP + HEAP_SIZE - BLOCK_SIZE + BLOCK_NEXT] = NIL; // Mark the end of the free list
  }

  /**
   * Allocates memory from the heap.
   * @param size - The size of the memory to allocate.
   * @returns The starting block index or NIL if allocation fails.
   */
  malloc(size: number): number {
    if (size <= 0) return NIL;

    const numBlocks = Math.ceil(size / BLOCK_SIZE);
    let current = this.freeList;
    let prev = NIL;
    let startBlock = current;
    let blocksFound = 0;

    while (current !== NIL && blocksFound < numBlocks) {
      blocksFound++;
      prev = current;
      current = this.memory[current + BLOCK_NEXT]; // Use BLOCK_NEXT for traversal
    }

    if (blocksFound < numBlocks) {
      if (startBlock !== NIL) {
        this.memory[prev + BLOCK_NEXT] = this.freeList;
        this.freeList = startBlock;
      }
      return NIL;
    }

    this.memory[prev + BLOCK_NEXT] = NIL;
    this.freeList = current;
    this.memory[startBlock + 1] = size; // Store size in the first block (if needed)

    return startBlock;
  }

  /**
   * Frees memory back to the heap.
   * @param pointer - The starting block index to free.
   */
  free(pointer: number): void {
    if (pointer === NIL) return;

    let current = pointer;
    const oldFreeListHead = this.freeList;

    while (this.memory[current + BLOCK_NEXT] !== NIL) {
      current = this.memory[current + BLOCK_NEXT]; // Use BLOCK_NEXT for traversal
    }

    this.memory[current + BLOCK_NEXT] = oldFreeListHead;
    this.freeList = pointer;
  }
}