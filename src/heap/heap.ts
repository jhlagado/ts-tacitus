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

/**
 * Manages dynamic memory allocation within a fixed-size heap segment using
 * fixed-size blocks, a free list, reference counting, and copy-on-write.
 */
export class Heap {
  memory: Memory;
  /** Index of the first block in the free list, or INVALID if the list is empty. */
  freeList: number;

  /**
   * Creates a new Heap instance.
   * @param memory The Memory instance managing the underlying ArrayBuffer.
   */
  constructor(memory: Memory) {
    this.memory = memory;
    this.freeList = INVALID; // Initialize freeList before use
    this.initializeFreeList();
  }

  /**
   * Initializes the heap by creating a linked list of all available blocks (the free list).
   * Each block's `BLOCK_NEXT` field points to the index of the next free block.
   * The last block's `BLOCK_NEXT` is set to `INVALID`.
   * Reference counts are initialized to 0.
   */
  private initializeFreeList(): void {
    const numBlocks = Math.floor(HEAP_SIZE / BLOCK_SIZE);
    if (numBlocks === 0) {
      this.freeList = INVALID;
      return;
    }

    this.freeList = 0;
    for (let i = 0; i < numBlocks - 1; i++) {
      const currentOffset = this.blockToByteOffset(i);
      this.memory.write16(SEG_HEAP, currentOffset + BLOCK_NEXT, i + 1);
      this.memory.write16(SEG_HEAP, currentOffset + BLOCK_REFS, 0);
    }

    const lastBlockOffset = this.blockToByteOffset(numBlocks - 1);
    this.memory.write16(SEG_HEAP, lastBlockOffset + BLOCK_NEXT, INVALID);
    this.memory.write16(SEG_HEAP, lastBlockOffset + BLOCK_REFS, 0);
  }

  /**
   * Converts a block index to its corresponding byte offset within the heap segment.
   * @param blockIndex The index of the block.
   * @returns The starting byte offset of the block.
   * @throws Error if the block index is negative.
   */
  blockToByteOffset(blockIndex: number): number {
    if (blockIndex < 0) {
      throw new Error(`Invalid block index: ${blockIndex}`);
    }
    return blockIndex * BLOCK_SIZE;
  }

  /**
   * Allocates a sequence of memory blocks large enough to hold `size` bytes.
   * Blocks are taken from the free list and chained together.
   * The reference count of the *first* allocated block is initialized to 1.
   *
   * @param size The number of bytes to allocate. Must be greater than 0.
   * @returns The index of the first allocated block, or `INVALID` if allocation fails.
   */
  malloc(size: number): number {
    if (size <= 0) return INVALID;

    const numBlocksNeeded = Math.ceil(size / USABLE_BLOCK_SIZE);
    if (numBlocksNeeded === 0) return INVALID;

    let headBlock = INVALID;
    let tailBlock = INVALID;
    let blocksAllocated = 0;
    const allocatedBlocksIndices: number[] = []; // Store indices for potential rollback

    // Try to grab required blocks from free list
    while (blocksAllocated < numBlocksNeeded && this.freeList !== INVALID) {
      const currentBlock = this.freeList;
      const currentOffset = this.blockToByteOffset(currentBlock);

      // Move freeList pointer to the next free block
      this.freeList = this.memory.read16(SEG_HEAP, currentOffset + BLOCK_NEXT);
      allocatedBlocksIndices.push(currentBlock); // Track allocated block

      if (headBlock === INVALID) {
        headBlock = currentBlock; // First block is the head
      } else {
        // Link the previous block (tailBlock) to the current block
        this.memory.write16(SEG_HEAP, this.blockToByteOffset(tailBlock) + BLOCK_NEXT, currentBlock);
      }
      tailBlock = currentBlock; // Update tail to the current block
      blocksAllocated++;
    }

    // Check if allocation succeeded
    if (blocksAllocated < numBlocksNeeded) {
      // Failed to allocate enough blocks, return them to the free list
      for (let i = allocatedBlocksIndices.length - 1; i >= 0; i--) {
        this.addToFreeList(allocatedBlocksIndices[i]); // addToFreeList resets refs to 0
      }
      // Restore original freeList pointer if we took some blocks
      if (allocatedBlocksIndices.length > 0 && headBlock !== INVALID) {
        // This part might need refinement depending on exact free list state desired on failure
        // For now, addToFreeList handles putting them back individually.
      }
      return INVALID; // Indicate allocation failure
    }

    // Allocation successful
    // Set reference count for the *first* block only
    if (headBlock !== INVALID) {
      this.memory.write16(SEG_HEAP, this.blockToByteOffset(headBlock) + BLOCK_REFS, 1);
      // Ensure subsequent blocks in this allocation have ref count 0 initially
      let current = this.memory.read16(SEG_HEAP, this.blockToByteOffset(headBlock) + BLOCK_NEXT);
      while (current !== INVALID && allocatedBlocksIndices.includes(current)) {
        // Check if it's part of *this* allocation chain
        this.memory.write16(SEG_HEAP, this.blockToByteOffset(current) + BLOCK_REFS, 0);
        const next = this.memory.read16(SEG_HEAP, this.blockToByteOffset(current) + BLOCK_NEXT);
        // Break if next block wasn't part of this specific malloc call (shouldn't happen with current logic)
        if (!allocatedBlocksIndices.includes(next) && next !== INVALID) break;
        current = next;
      }
    }

    // Terminate the chain for the last allocated block
    if (tailBlock !== INVALID) {
      this.memory.write16(SEG_HEAP, this.blockToByteOffset(tailBlock) + BLOCK_NEXT, INVALID);
    }

    return headBlock;
  }

  /**
   * Decrements the reference count of the allocation starting at the given block index.
   * If the reference count drops to zero, the block is freed, and this function is
   * recursively called on the next block in the chain (if any).
   *
   * @param block The index of the block whose reference count should be decremented.
   */
  decrementRef(block: number): void {
    if (block === INVALID || block < 0 || this.blockToByteOffset(block) >= HEAP_SIZE) {
      return;
    }

    const byteOffset = this.blockToByteOffset(block);
    let refs = this.memory.read16(SEG_HEAP, byteOffset + BLOCK_REFS);

    if (refs > 0) {
      refs--;
      this.memory.write16(SEG_HEAP, byteOffset + BLOCK_REFS, refs);

      if (refs === 0) {
        // Reference count reached zero for this specific block.
        // Read the next block *before* freeing the current one.
        const nextBlock = this.memory.read16(SEG_HEAP, byteOffset + BLOCK_NEXT);

        // Free the current block.
        this.addToFreeList(block);

        // Recursively decrement the reference count of the next block in the chain.
        // This handles freeing the entire chain link by link when the initial
        // reference (usually held by the first block) is released.
        this.decrementRef(nextBlock);
      }
    } else {
      // If refs is already 0, log an error or handle as appropriate.
      // This might indicate a double-free attempt or a logic error elsewhere.
      // console.warn(`Attempted to decrement ref count of block ${block} which is already 0.`);
    }
  }

  /**
   * Adds a single block back to the head of the free list.
   * Assumes the block is valid and no longer part of an active allocation chain's structure.
   * @param block The index of the block to free.
   */
  private addToFreeList(block: number): void {
    if (block === INVALID || block < 0 || this.blockToByteOffset(block) >= HEAP_SIZE) {
      return;
    }
    const byteOffset = this.blockToByteOffset(block);
    this.memory.write16(SEG_HEAP, byteOffset + BLOCK_NEXT, this.freeList);
    this.memory.write16(SEG_HEAP, byteOffset + BLOCK_REFS, 0);
    this.freeList = block;
  }

  /**
   * Increments the reference count of the allocation starting at the given block index.
   *
   * @param block The index of the *first* block of the allocation.
   */
  incrementRef(block: number): void {
    if (block === INVALID || block < 0 || this.blockToByteOffset(block) >= HEAP_SIZE) {
      return;
    }
    const byteOffset = this.blockToByteOffset(block);
    const refs = this.memory.read16(SEG_HEAP, byteOffset + BLOCK_REFS);
    if (refs < 0xffff) {
      this.memory.write16(SEG_HEAP, byteOffset + BLOCK_REFS, refs + 1);
    } else {
      console.error(`Reference count overflow for block ${block}`);
    }
  }

  /**
   * Gets the current reference count for the allocation starting at the given block.
   * @param block The starting block index of the allocation.
   * @returns The current reference count. Returns 0 if the block index is invalid or out of bounds.
   */
  getRefCount(block: number): number {
    if (block === INVALID || block < 0 || this.blockToByteOffset(block) >= HEAP_SIZE) {
      return 0;
    }
    const byteOffset = this.blockToByteOffset(block);
    return this.memory.read16(SEG_HEAP, byteOffset + BLOCK_REFS);
  }

  /**
   * Gets the index of the next block in the chain.
   * @param block The index of the current block.
   * @returns The index of the next block, or `INVALID` if it's the last block in the chain.
   * @throws Error if the provided block index is `INVALID` or out of bounds.
   */
  getNextBlock(block: number): number {
    if (block === INVALID) {
      throw new Error('Cannot get next block of INVALID.');
    }
    if (block < 0 || this.blockToByteOffset(block) >= HEAP_SIZE) {
      throw new Error(`Invalid block index: ${block}`);
    }
    return this.memory.read16(SEG_HEAP, this.blockToByteOffset(block) + BLOCK_NEXT);
  }

  /**
   * Sets the next block pointer for a given parent block, adjusting reference counts accordingly.
   * Decrements the reference count of the old child (if any) and increments the reference count
   * of the new child (if not INVALID).
   *
   * @param parent The index of the block whose `BLOCK_NEXT` pointer should be updated.
   * @param child The index of the new next block (`INVALID` to terminate the chain here).
   * @throws Error if the parent or child block index is `INVALID` or out of bounds.
   */
  setNextBlock(parent: number, child: number): void {
    if (parent === INVALID) {
      throw new Error('Cannot set next block for INVALID parent.');
    }
    if (parent < 0 || this.blockToByteOffset(parent) >= HEAP_SIZE) {
      throw new Error(`Invalid parent block index: ${parent}`);
    }
    if (child !== INVALID && (child < 0 || this.blockToByteOffset(child) >= HEAP_SIZE)) {
      throw new Error(`Invalid child block index: ${child}`);
    }

    const parentByteOffset = this.blockToByteOffset(parent);
    const oldChild = this.memory.read16(SEG_HEAP, parentByteOffset + BLOCK_NEXT);

    // Only proceed if the child is actually changing
    if (oldChild !== child) {
      // Update pointer first
      this.memory.write16(SEG_HEAP, parentByteOffset + BLOCK_NEXT, child);

      // Adjust reference counts
      if (oldChild !== INVALID) {
        this.decrementRef(oldChild);
      }
      if (child !== INVALID) {
        this.incrementRef(child);
      }
    }
  }

  /**
   * Creates a deep copy of a single block, including its data content.
   * Allocates a new block, copies the data from the source block,
   * resets the new block's reference count to 1, and preserves the link
   * to the *next* block (incrementing its reference count).
   *
   * @param block The index of the block to clone.
   * @returns The index of the newly allocated and cloned block, or `INVALID` if allocation fails.
   * @throws Error if the source block index is `INVALID` or out of bounds.
   */
  cloneBlock(block: number): number {
    if (block === INVALID) {
      throw new Error('Cannot clone INVALID block.');
    }
    if (block < 0 || this.blockToByteOffset(block) >= HEAP_SIZE) {
      throw new Error(`Invalid block index for cloning: ${block}`);
    }

    const newBlock = this.malloc(USABLE_BLOCK_SIZE);
    if (newBlock === INVALID) {
      return INVALID;
    }

    const srcOffset = this.blockToByteOffset(block);
    const destOffset = this.blockToByteOffset(newBlock);
    const base = this.memory.resolveAddress(SEG_HEAP, 0);

    for (let i = 0; i < BLOCK_SIZE; i++) {
      this.memory.buffer[base + destOffset + i] = this.memory.buffer[base + srcOffset + i];
    }

    this.memory.write16(SEG_HEAP, destOffset + BLOCK_REFS, 1);

    const nextBlock = this.memory.read16(SEG_HEAP, destOffset + BLOCK_NEXT);

    if (nextBlock !== INVALID) {
      this.incrementRef(nextBlock);
    }

    return newBlock;
  }

  /**
   * Implements the copy-on-write mechanism.
   * If the given block has a reference count greater than 1, it clones the block
   * using `cloneBlock`. If a `prevBlockPtr` is provided, it updates the previous
   * block's `BLOCK_NEXT` pointer to point to the newly cloned block.
   * Finally, it decrements the reference count of the original block (as the reference
   * is moving to the clone).
   *
   * @param blockPtr The index of the block to potentially copy.
   * @param prevBlockPtr (Optional) The index of the block preceding `blockPtr` in a chain.
   *                     If provided, its `BLOCK_NEXT` will be updated to point to the clone.
   * @returns The index of the block to be used after the operation (either the original or the clone),
   *          or `INVALID` if cloning fails.
   * @throws Error if `blockPtr` or `prevBlockPtr` (if provided and not INVALID) is invalid.
   */
  copyOnWrite(blockPtr: number, prevBlockPtr?: number): number {
    if (blockPtr === INVALID) {
      return INVALID;
    }
    if (blockPtr < 0 || this.blockToByteOffset(blockPtr) >= HEAP_SIZE) {
      throw new Error(`Invalid block index for copy-on-write: ${blockPtr}`);
    }
    if (
      prevBlockPtr !== undefined &&
      prevBlockPtr !== INVALID &&
      (prevBlockPtr < 0 || this.blockToByteOffset(prevBlockPtr) >= HEAP_SIZE)
    ) {
      throw new Error(`Invalid previous block index for copy-on-write: ${prevBlockPtr}`);
    }

    const refs = this.getRefCount(blockPtr);

    if (refs > 1) {
      const newBlock = this.cloneBlock(blockPtr);
      if (newBlock === INVALID) {
        return INVALID;
      }

      if (prevBlockPtr !== undefined && prevBlockPtr !== INVALID) {
        const prevOffset = this.blockToByteOffset(prevBlockPtr);
        this.memory.write16(SEG_HEAP, prevOffset + BLOCK_NEXT, newBlock);
      }

      this.decrementRef(blockPtr);

      return newBlock;
    } else {
      return blockPtr;
    }
  }

  /**
   * Calculates the total amount of available memory in bytes by traversing the free list.
   * Includes basic cycle detection to prevent infinite loops in case of list corruption.
   * @returns The total number of bytes available for allocation.
   */
  available(): number {
    let count = 0;
    let current = this.freeList;
    const visited = new Set<number>();

    while (current !== INVALID) {
      if (visited.has(current)) {
        console.error('Cycle detected in free list at block:', current);
        break;
      }
      visited.add(current);

      if (current < 0 || this.blockToByteOffset(current) >= HEAP_SIZE) {
        console.error('Invalid block index encountered in free list:', current);
        break;
      }

      count++;
      const currentOffset = this.blockToByteOffset(current);
      current = this.memory.read16(SEG_HEAP, currentOffset + BLOCK_NEXT);
    }
    return count * BLOCK_SIZE;
  }
}
