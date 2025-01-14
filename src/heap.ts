import { HEAP, HEAP_SIZE, BLOCK_SIZE, NIL } from "./constants";

export class Heap {
  start: number;
  size: number;
  freeList: number;

  constructor(private memory: number[]) {
    this.start = HEAP;
    this.size = HEAP_SIZE / BLOCK_SIZE;
    this.freeList = HEAP;
    this.initializeFreeList();
  }

  /**
   * Initializes the free list for the heap.
   */
  private initializeFreeList(): void {
    for (let i = HEAP; i < HEAP + HEAP_SIZE; i += BLOCK_SIZE) {
      this.memory[i] = i + BLOCK_SIZE;
    }
    this.memory[HEAP + HEAP_SIZE - BLOCK_SIZE] = NIL;
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
      current = this.memory[current];
    }

    if (blocksFound < numBlocks) {
      if (startBlock !== NIL) {
        this.memory[prev] = this.freeList;
        this.freeList = startBlock;
      }
      return NIL;
    }

    this.memory[prev] = NIL;
    this.freeList = current;
    this.memory[startBlock + 1] = size;

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

    while (this.memory[current] !== NIL) {
      current = this.memory[current];
    }

    this.memory[current] = oldFreeListHead;
    this.freeList = pointer;
  }
}