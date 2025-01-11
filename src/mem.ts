// Constants
export const BLOCK_SIZE = 16; // Each block is 16 bytes
export const MEMORY_SIZE = 1024; // Total memory size
export const NIL = -1; // Represents a null pointer

// Memory type
export type Memory = {
  data: number[]; // Memory array
  freeList: number; // Pointer to the head of the free list
};

// Initialize memory
export function initializeMemory(): Memory {
  const memory: Memory = {
    data: new Array(MEMORY_SIZE).fill(0),
    freeList: 0, // Start with all blocks in the free list
  };

  // Initialize the free list
  for (let i = 0; i < MEMORY_SIZE; i += BLOCK_SIZE) {
    memory.data[i] = i + BLOCK_SIZE; // Point to the next block
  }
  memory.data[MEMORY_SIZE - BLOCK_SIZE] = NIL; // End of the free list

  return memory;
}

// Allocate memory
export function malloc(memory: Memory, size: number): number {
  if (size <= 0) {
    return NIL; // Invalid size, return NIL
  }

  const numBlocks = Math.ceil(size / BLOCK_SIZE); // Number of blocks needed
  let current = memory.freeList;
  let prev = NIL; // Track the previous block
  let startBlock = current; // Initialize startBlock with current (first block)
  let blocksFound = 0;

  // Traverse the free list to find the required number of blocks
  while (current !== NIL && blocksFound < numBlocks) {
    blocksFound++;
    prev = current; // Save the previous block
    current = memory.data[current]; // Move to the next block in the free list
  }

  if (blocksFound < numBlocks) {
    // Not enough blocks found, roll back any partially allocated blocks
    if (startBlock !== NIL) {
      memory.data[prev] = memory.freeList; // Link the last partially allocated block to the free list
      memory.freeList = startBlock; // Update the free list to point to the start of the partially allocated chain
    }
    return NIL; // Not enough free blocks
  }

  // Link the last block in the allocated chain to NIL
  memory.data[prev] = NIL;

  // Update the free list to point to the next available block
  memory.freeList = current;

  // Store the size in the first block (optional, for metadata)
  memory.data[startBlock + 1] = size;

  return startBlock; // Return the starting block index
}

// Free memory
export function free(memory: Memory, pointer: number): void {
  if (pointer === NIL) return; // Nothing to free

  let current = pointer;
  const oldFreeListHead = memory.freeList; // Save the current head of the free list

  // Traverse to the end of the chain of blocks being freed
  while (memory.data[current] !== NIL) {
    current = memory.data[current];
  }

  // Make the last block in the freed chain point to the old free list head
  memory.data[current] = oldFreeListHead;

  // Update the free list head to point to the start of the freed chain
  memory.freeList = pointer;
}
