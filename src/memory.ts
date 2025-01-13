import { MEMORY_SIZE, HEAP, HEAP_SIZE, BLOCK_SIZE, NIL } from "./constants";
import { Memory, Heap } from "./types";

// Initialize memory
export function initMemory(): Memory {
  return {
    data: new Array(MEMORY_SIZE).fill(0), // Initialize memory with zeros
  };
}

// Initialize heap
export function initHeap(memory: Memory): Heap {
  const heap: Heap = {
    start: HEAP,
    size: HEAP_SIZE / BLOCK_SIZE, // Heap size in blocks
    freeList: HEAP, // Start of the heap is the first free block
  };

  // Initialize the free list within the heap bounds
  for (let i = HEAP; i < HEAP + HEAP_SIZE; i += BLOCK_SIZE) {
    memory.data[i] = i + BLOCK_SIZE; // Point to the next block
  }
  memory.data[HEAP + HEAP_SIZE - BLOCK_SIZE] = NIL; // End of the free list

  return heap;
}

// Allocate memory
export function malloc(memory: Memory, heap: Heap, size: number): number {
  if (size <= 0) {
    return NIL; // Invalid size, return NIL
  }

  const numBlocks = Math.ceil(size / BLOCK_SIZE); // Number of blocks needed
  let current = heap.freeList;
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
      memory.data[prev] = heap.freeList; // Link the last partially allocated block to the free list
      heap.freeList = startBlock; // Update the free list to point to the start of the partially allocated chain
    }
    return NIL; // Not enough free blocks
  }

  // Link the last block in the allocated chain to NIL
  memory.data[prev] = NIL;

  // Update the free list to point to the next available block
  heap.freeList = current;

  // Store the size in the first block (optional, for metadata)
  memory.data[startBlock + 1] = size;

  return startBlock; // Return the starting block index
}

// Free memory
export function free(memory: Memory, heap: Heap, pointer: number): void {
  if (pointer === NIL) return; // Nothing to free

  let current = pointer;
  const oldFreeListHead = heap.freeList; // Save the current head of the free list

  // Traverse to the end of the chain of blocks being freed
  while (memory.data[current] !== NIL) {
    current = memory.data[current];
  }

  // Make the last block in the freed chain point to the old free list head
  memory.data[current] = oldFreeListHead;

  // Update the free list head to point to the start of the freed chain
  heap.freeList = pointer;
}
