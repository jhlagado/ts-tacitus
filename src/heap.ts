import { NIL } from "./constants";
import { Memory, HEAP, HEAP_SIZE } from "./memory";

export const BLOCK_SIZE = 128; // Each block is 128 bytes
export const BLOCK_NEXT = 0; // Offset for next block pointer (2 bytes)
export const BLOCK_REFS = 2; // Offset for reference count (2 bytes)
export const USABLE_BLOCK_SIZE = BLOCK_SIZE - 4; // Account for header

export class Heap {
  memory: Memory;
  freeList: number;

  constructor(memory: Memory) {
    this.memory = memory;
    this.freeList = HEAP;
    this.initializeFreeList();
  }

  private initializeFreeList(): void {
    let current = HEAP;
    while (current + BLOCK_SIZE < HEAP + HEAP_SIZE) {
      this.memory.write16(current + BLOCK_NEXT, current + BLOCK_SIZE);
      this.memory.write16(current + BLOCK_REFS, 0); // Free blocks have 0 refs
      current += BLOCK_SIZE;
    }
    this.memory.write16(current + BLOCK_NEXT, NIL);
    this.memory.write16(current + BLOCK_REFS, 0);
  }

  // In Heap class
  malloc(size: number): number {
    if (size <= 0) return NIL;

    const numBlocks = Math.ceil(size / USABLE_BLOCK_SIZE);
    let current = this.freeList;
    let prev = NIL;
    let startBlock = current;
    let blocksFound = 0;

    // Find contiguous blocks (original logic)
    while (current !== NIL && blocksFound < numBlocks) {
      blocksFound++;
      prev = current;
      current = this.memory.read16(current + BLOCK_NEXT);
    }

    if (blocksFound < numBlocks) {
      if (startBlock !== NIL) {
        this.memory.write16(prev + BLOCK_NEXT, this.freeList);
        this.freeList = startBlock;
      }
      return NIL;
    }

    // Link blocks and set reference counts
    let block = startBlock;
    for (let i = 0; i < numBlocks; i++) {
      this.memory.write16(block + BLOCK_REFS, 1);

      // Set BLOCK_NEXT to next physical block if not last
      if (i < numBlocks - 1) {
        const nextBlock = block + BLOCK_SIZE;
        this.memory.write16(block + BLOCK_NEXT, nextBlock);
      } else {
        this.memory.write16(block + BLOCK_NEXT, NIL);
      }

      block += BLOCK_SIZE; // Move to next physical block
    }

    // Update free list
    this.freeList = current;
    return startBlock;
  }
  
  free(pointer: number): void {
    this.decrementRef(pointer);
  }

  decrementRef(block: number): void {
    if (block === NIL) return;

    const refs = this.memory.read16(block + BLOCK_REFS) - 1;
    this.memory.write16(block + BLOCK_REFS, refs);

    if (refs === 0) {
      const next = this.memory.read16(block + BLOCK_NEXT);
      this.decrementRef(next);
      this.addToFreeList(block);
    }
  }

  private addToFreeList(block: number): void {
    this.memory.write16(block + BLOCK_NEXT, this.freeList);
    this.freeList = block;
  }

  incrementRef(block: number): void {
    if (block === NIL) return;
    const refs = this.memory.read16(block + BLOCK_REFS);
    this.memory.write16(block + BLOCK_REFS, refs + 1);
  }

  setNextBlock(parent: number, child: number): void {
    const oldChild = this.memory.read16(parent + BLOCK_NEXT);
    if (oldChild !== NIL) this.decrementRef(oldChild);

    this.memory.write16(parent + BLOCK_NEXT, child);
    if (child !== NIL) this.incrementRef(child);
  }

  available(): number {
    let count = 0;
    let current = this.freeList;
    while (current !== NIL) {
      count++;
      current = this.memory.read16(current + BLOCK_NEXT);
    }
    return count * BLOCK_SIZE;
  }
}
