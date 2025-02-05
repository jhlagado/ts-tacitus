import { NIL } from "./constants";
import { Memory, HEAP, HEAP_SIZE } from "./memory";

export const BLOCK_SIZE = 64;
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
    let i = 0;
    console.log("initializest", { current });
    while (current + BLOCK_SIZE < HEAP + HEAP_SIZE) {
      this.memory.write16(current + BLOCK_NEXT, current + BLOCK_SIZE);
      this.memory.write16(current + BLOCK_REFS, 0); // Free blocks have 0 refs
      current += BLOCK_SIZE;
      i++;
    }
    console.log("initializeFreeList", { i, current, HEAP_SIZE });
    this.memory.write16(current + BLOCK_NEXT, NIL);
    this.memory.write16(current + BLOCK_REFS, 0);
  }

  malloc(size: number): number {
    if (size <= 0) return NIL;

    const numBlocks = Math.ceil(size / USABLE_BLOCK_SIZE);
    let current = this.freeList;
    let prev = NIL;
    let startBlock = current;
    let blocksFound = 0;

    // Traverse the free list to find enough contiguous blocks
    while (current !== NIL && blocksFound < numBlocks) {
      blocksFound++;
      prev = current;
      current = this.memory.read16(current + BLOCK_NEXT);
    }

    // If not enough blocks are found, reset the traversed blocks and return NIL
    if (blocksFound < numBlocks) {
      if (startBlock !== NIL) {
        this.memory.write16(prev + BLOCK_NEXT, this.freeList);
        this.freeList = startBlock;
      }
      return NIL;
    }

    // Allocate the blocks: set reference counts and link them
    let block = startBlock;
    for (let i = 0; i < numBlocks; i++) {
      this.memory.write16(block + BLOCK_REFS, 1); // Initialize reference count
      this.memory.write16(
        block + BLOCK_NEXT,
        i < numBlocks - 1 ? block + BLOCK_SIZE : NIL
      ); // Link to next block or NIL
      block += BLOCK_SIZE;
    }

    // Update the free list to point to the remaining free blocks
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

  getNextBlock(block: number): number {
    if (block === NIL) {
      throw new Error("Cannot get next block of NIL.");
    }
    return this.memory.read16(block + BLOCK_NEXT);
  }

  setNextBlock(parent: number, child: number): void {
    const oldChild = this.memory.read16(parent + BLOCK_NEXT);
    if (oldChild !== NIL) this.decrementRef(oldChild);

    this.memory.write16(parent + BLOCK_NEXT, child);
    if (child !== NIL) this.incrementRef(child);
  }

  /**
   * Clones a block and its contents.
   * @param heap - The heap instance.
   * @param block - The block to clone.
   * @returns The pointer to the newly cloned block.
   */
  cloneBlock(block: number): number {
    const newBlock = this.malloc(BLOCK_SIZE);
    if (newBlock === NIL) return NIL;

    this.memory.buffer.copyWithin(newBlock, block, block + BLOCK_SIZE);
    this.memory.write16(newBlock + BLOCK_REFS, 1);

    // Handle child blocks
    const nextBlock = this.memory.read16(block + BLOCK_NEXT);
    if (nextBlock !== NIL) this.incrementRef(nextBlock);

    return newBlock;
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
