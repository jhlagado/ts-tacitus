/**
 * @fileoverview This file defines the `Heap` class, a crucial component of the Tacit runtime responsible for
 * dynamic memory management. It implements a fixed-size block allocator with reference counting and
 * a copy-on-write mechanism to ensure efficient and safe memory usage. The `Heap` class interacts closely
 * with the `Memory` module to manage a specific segment of the overall memory space, providing functions
 * for allocating, freeing, and manipulating memory blocks. The core data structure is a free list, which
 * tracks available blocks, and each block includes metadata for reference counting and linking to other
 * blocks. This design supports efficient garbage collection and memory reuse, essential for the
 * performance and stability of the Tacit language.
 *
 * @architectural_observation The heap employs a fixed-size block allocation strategy (`BLOCK_SIZE`), dividing the allocated memory region into blocks of equal size.
 * Allocations larger than one block are handled by chaining blocks together using a pointer stored at the `BLOCK_NEXT` offset within each block's header.
 * Reference counting is used for automatic memory management. The reference count, stored at the `BLOCK_REFS` offset in the *first* block of an allocation, tracks the number of references to the entire allocation (potentially spanning multiple chained blocks).
 * When the reference count of the first block reaches zero via `decrementRef`, the `Heap` traverses the chain using the `BLOCK_NEXT` pointers and frees all blocks belonging to that allocation by adding them back to the free list.
 * A copy-on-write mechanism (`copyOnWrite`) is implemented to optimize data duplication, creating copies of shared blocks only when modifications are necessary and the reference count is greater than one.
 */

import { INVALID } from '../core/constants';
import { Memory, HEAP_SIZE, SEG_HEAP } from '../core/memory';

export const BLOCK_SIZE = 64;
export const BLOCK_NEXT = 0; // Offset for next block pointer (2 bytes)
export const BLOCK_REFS = 2; // Offset for reference count (2 bytes)
export const USABLE_BLOCK_SIZE = BLOCK_SIZE - 4; // Account for header

export class Heap {
  memory: Memory;
  freeList: number;

  constructor(memory: Memory) {
    this.memory = memory;
    this.freeList = 0;
    this.initializeFreeList();
  }

  private initializeFreeList(): void {
    // Calculate the number of blocks that can fit in the heap
    const numBlocks = Math.floor(HEAP_SIZE / BLOCK_SIZE);

    // Link blocks by index (not byte offset)
    for (let i = 0; i < numBlocks - 1; i++) {
      this.memory.write16(SEG_HEAP, this.blockToByteOffset(i) + BLOCK_NEXT, i + 1);
      this.memory.write16(SEG_HEAP, this.blockToByteOffset(i) + BLOCK_REFS, 0);
    }

    // Set the last block's next pointer to INVALID
    this.memory.write16(SEG_HEAP, this.blockToByteOffset(numBlocks - 1) + BLOCK_NEXT, INVALID);
    this.memory.write16(SEG_HEAP, this.blockToByteOffset(numBlocks - 1) + BLOCK_REFS, 0);
  }

  // Helper method to convert block index to byte offset
  blockToByteOffset(blockIndex: number): number {
    return blockIndex * BLOCK_SIZE;
  }

  malloc(size: number): number {
    if (size <= 0) return INVALID;

    const numBlocks = Math.ceil(size / USABLE_BLOCK_SIZE);
    let current = this.freeList;
    let prev = INVALID;
    let startBlock = current;
    let blocksFound = 0;
    console.warn('malloc1', current, size, this.freeList);

    // Traverse the free list to find enough blocks
    while (current !== INVALID && blocksFound < numBlocks) {
      blocksFound++;
      prev = current;
      current = this.memory.read16(SEG_HEAP, this.blockToByteOffset(current) + BLOCK_NEXT);
    }

    // If not enough blocks are found, reset the traversed blocks and return NULL
    if (blocksFound < numBlocks) {
      if (startBlock !== INVALID) {
        this.memory.write16(SEG_HEAP, this.blockToByteOffset(prev) + BLOCK_NEXT, this.freeList);
        this.freeList = startBlock;
      }
      return INVALID;
    }

    // Allocate the blocks: set reference counts and link them
    let block = startBlock;
    for (let i = 0; i < numBlocks; i++) {
      this.memory.write16(SEG_HEAP, this.blockToByteOffset(block) + BLOCK_REFS, 1);
      this.memory.write16(
        SEG_HEAP,
        this.blockToByteOffset(block) + BLOCK_NEXT,
        i < numBlocks - 1 ? block + 1 : INVALID
      );
      block++;
    }

    // Update the free list to point to the remaining free blocks
    this.freeList = current;
    return startBlock;
  }

  // Remove the public free method. Cleanup is handled via decrementRef.
  // free(block: number): void {
  //   console.log('!!! free', block, this.freeList);
  //   this.decrementRef(block);
  // }

  decrementRef(block: number): void {
    if (block === INVALID) return;

    // Check if the block index is valid before accessing memory
    if (block * BLOCK_SIZE >= HEAP_SIZE) return;

    const byteOffset = this.blockToByteOffset(block);
    const refs = this.memory.read16(SEG_HEAP, byteOffset + BLOCK_REFS) - 1;
    this.memory.write16(SEG_HEAP, byteOffset + BLOCK_REFS, refs);

    if (refs === 0) {
      const next = this.memory.read16(SEG_HEAP, byteOffset + BLOCK_NEXT);
      this.decrementRef(next);
      this.addToFreeList(block);
    }
  }

  private addToFreeList(block: number): void {
    this.memory.write16(SEG_HEAP, this.blockToByteOffset(block) + BLOCK_NEXT, this.freeList);
    this.freeList = block;
  }

  incrementRef(block: number): void {
    if (block === INVALID) return;
    const byteOffset = this.blockToByteOffset(block);
    const refs = this.memory.read16(SEG_HEAP, byteOffset + BLOCK_REFS);
    this.memory.write16(SEG_HEAP, byteOffset + BLOCK_REFS, refs + 1);
  }

  /**
   * Gets the current reference count for the allocation starting at the given block.
   * @param block The starting block index of the allocation.
   * @returns The current reference count. Returns 0 if block is INVALID or out of bounds.
   */
  getRefCount(block: number): number {
    if (block === INVALID || block * BLOCK_SIZE >= HEAP_SIZE) {
      return 0; // Or throw an error if preferred for invalid blocks
    }
    const byteOffset = this.blockToByteOffset(block);
    return this.memory.read16(SEG_HEAP, byteOffset + BLOCK_REFS);
  }

  getNextBlock(block: number): number {
    if (block === INVALID) {
      throw new Error('Cannot get next block of NULL.');
    }
    return this.memory.read16(SEG_HEAP, this.blockToByteOffset(block) + BLOCK_NEXT);
  }

  setNextBlock(parent: number, child: number): void {
    const parentByteOffset = this.blockToByteOffset(parent);
    const oldChild = this.memory.read16(SEG_HEAP, parentByteOffset + BLOCK_NEXT);
    console.log('setNextBlock', parent, child, oldChild);
    if (oldChild !== INVALID) this.decrementRef(oldChild);

    this.memory.write16(SEG_HEAP, parentByteOffset + BLOCK_NEXT, child);
    if (child !== INVALID) this.incrementRef(child);
  }

  cloneBlock(block: number): number {
    const newBlock = this.malloc(USABLE_BLOCK_SIZE);
    if (newBlock === INVALID) return INVALID;

    // Copy block content
    const srcOffset = this.blockToByteOffset(block);
    const destOffset = this.blockToByteOffset(newBlock);

    // Get the base address of the heap segment
    const base = this.memory.resolveAddress(SEG_HEAP, 0);

    // Manually copy BLOCK_SIZE bytes
    for (let i = 0; i < BLOCK_SIZE; i++) {
      this.memory.buffer[base + destOffset + i] = this.memory.buffer[base + srcOffset + i];
    }

    // Reset the reference count on the new block
    this.memory.write16(SEG_HEAP, destOffset + BLOCK_REFS, 1);

    // If there's a chained block, update its reference
    const nextBlock = this.memory.read16(SEG_HEAP, srcOffset + BLOCK_NEXT);
    if (nextBlock !== INVALID) this.incrementRef(nextBlock);

    return newBlock;
  }

  copyOnWrite(blockPtr: number, prevBlockPtr?: number): number {
    if (blockPtr === INVALID) return INVALID;

    const byteOffset = this.blockToByteOffset(blockPtr);
    const refs = this.memory.read16(SEG_HEAP, byteOffset + BLOCK_REFS);

    if (refs > 1) {
      const newBlock = this.cloneBlock(blockPtr);
      if (newBlock === INVALID) return INVALID;

      if (prevBlockPtr !== undefined && prevBlockPtr !== INVALID) {
        // Update the previous block's next pointer to refer to the new clone
        this.memory.write16(SEG_HEAP, this.blockToByteOffset(prevBlockPtr) + BLOCK_NEXT, newBlock);
      }
      return newBlock;
    }
    return blockPtr;
  }

  available(): number {
    let count = 0;
    let current = this.freeList;
    while (current !== INVALID) {
      count++;
      current = this.memory.read16(SEG_HEAP, this.blockToByteOffset(current) + BLOCK_NEXT);
    }
    return count * BLOCK_SIZE;
  }
}
