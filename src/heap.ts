import { NIL } from "./constants"; // Import NIL from constants.ts
import { Memory, HEAP, HEAP_SIZE } from "./memory"; // Import memory-related constants from memory.ts

export const BLOCK_SIZE = 128; // Each block is 128 bytes
export const BLOCK_NEXT = 0; // Index 0: Pointer to the next block (16-bit, so occupies 2 bytes)
export const USABLE_BLOCK_SIZE = BLOCK_SIZE - 2;   // Account for the 2-byte overhead

export class Heap {
  memory: Memory;
  freeList: number;

  constructor(memory: Memory) {
    this.memory = memory;
    this.freeList = HEAP;
    this.initializeFreeList();
  }

  /**
   * Initializes the free list for the heap.
   */
  private initializeFreeList(): void {
    let current = HEAP;
    while (current + BLOCK_SIZE < HEAP + HEAP_SIZE) {
      this.memory.write16(current + BLOCK_NEXT, current + BLOCK_SIZE);
      current += BLOCK_SIZE;
    }
    // Mark the end of the free list
    this.memory.write16(current + BLOCK_NEXT, NIL); // Use NIL (0) to mark the end
  }

  /**
   * Allocates memory from the heap.
   * @param size - The size of the memory to allocate.
   * @returns The starting block index or NIL if allocation fails.
   */
  malloc(size: number): number {
    if (size <= 0) return NIL;

    // Calculate the number of blocks needed, accounting for the 2-byte overhead
    const numBlocks = Math.ceil(size / USABLE_BLOCK_SIZE);

    let current = this.freeList;
    let prev = NIL;
    let startBlock = current;
    let blocksFound = 0;

    // Traverse the free list to find enough blocks
    while (current !== NIL && blocksFound < numBlocks) {
      blocksFound++;
      prev = current;
      current = this.memory.read16(current + BLOCK_NEXT); // Read the next block address
    }

    // If not enough blocks are found, roll back and return NIL
    if (blocksFound < numBlocks) {
      if (startBlock !== NIL) {
        // Restore the free list by linking the last found block back to the free list
        this.memory.write16(prev + BLOCK_NEXT, this.freeList);
        this.freeList = startBlock;
      }
      return NIL;
    }

    // Update the free list to skip the allocated blocks
    this.memory.write16(prev + BLOCK_NEXT, NIL);
    this.freeList = current;

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

    // Traverse the blocks to find the end of the allocated region
    while (this.memory.read16(current + BLOCK_NEXT) !== NIL) {
      current = this.memory.read16(current + BLOCK_NEXT);
    }

    // Link the freed blocks back into the free list
    this.memory.write16(current + BLOCK_NEXT, oldFreeListHead);
    this.freeList = pointer;
  }

  available(): number {
    let current = this.freeList;
    let freeBlocks = 0;
  
    // Traverse the free list and count the number of free blocks
    while (current !== NIL) {
      freeBlocks++;
      current = this.memory.read16(current + BLOCK_NEXT);
    }
  
    // Multiply the number of free blocks by the block size to get the total free memory
    const totalFreeMemory = freeBlocks * BLOCK_SIZE;
    console.log(`Free blocks: ${freeBlocks}, Total free memory: ${totalFreeMemory}`);
    return totalFreeMemory;
  }
}
