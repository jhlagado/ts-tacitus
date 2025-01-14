import {
  STACK,
  RSTACK,
  STACK_SIZE,
  RSTACK_SIZE,
  CODE,
  VARS,
  CODE_SIZE,
  HEAP,
  VARS_SIZE,
  HEAP_SIZE,
  MEMORY_SIZE,
  BLOCK_SIZE,
  NIL,
} from "./constants";
import { initMemory, initHeap, malloc, free } from "./memory";
import { Memory, Heap } from "./types";

describe("Memory Allocator", () => {
  let memory: Memory;
  let heap: Heap;

  beforeEach(() => {
    memory = initMemory(); // Initialize memory
    heap = initHeap(memory); // Initialize heap
  });

  describe("Memory Layout", () => {
    it("should have the correct memory layout", () => {
      expect(STACK).toBe(0); // Stack starts at address 0
      expect(RSTACK).toBe(STACK + STACK_SIZE); // Return stack starts after the stack
      expect(CODE).toBe(RSTACK + RSTACK_SIZE); // Code area starts after the PAD
      expect(VARS).toBe(CODE + CODE_SIZE); // Variables area starts after the code area
      expect(HEAP).toBe(VARS + VARS_SIZE); // Heap starts after the variables area
    });

    it("should have the correct sizes for each region", () => {
      expect(STACK_SIZE).toBe(0x100); // Stack size
      expect(RSTACK_SIZE).toBe(0x100); // Return stack size
      expect(CODE_SIZE).toBe(0x400); // Code area size
      expect(VARS_SIZE).toBe(0x100); // Variables area size
      expect(HEAP_SIZE).toBe(0x1000); // Heap size
    });

    it("should fit within the total memory size", () => {
      const totalUsedMemory =
        STACK_SIZE + RSTACK_SIZE + CODE_SIZE + VARS_SIZE + HEAP_SIZE;
      expect(totalUsedMemory).toBeLessThanOrEqual(MEMORY_SIZE); // Ensure all regions fit in memory
    });
  });

  describe("Heap Initialization", () => {
    it("should initialize the heap within the correct bounds", () => {
      expect(heap.start).toBe(HEAP); // Heap starts at the correct address
      expect(heap.size).toBe(HEAP_SIZE / BLOCK_SIZE); // Heap size in blocks
      expect(heap.freeList).toBe(HEAP); // Free list starts at the heap's start
    });

    it("should initialize the free list correctly", () => {
      let current = heap.freeList;
      let blockCount = 0;

      while (current !== NIL) {
        blockCount++;
        current = memory[current];
      }

      expect(blockCount).toBe(HEAP_SIZE / BLOCK_SIZE); // All blocks should be in the free list
    });
  });

  describe("malloc", () => {
    it("should allocate a single block", () => {
      const ptr = malloc(memory, heap, 10); // Request 10 bytes (1 block)
      expect(ptr).toBe(HEAP); // First block is allocated
      expect(heap.freeList).toBe(HEAP + BLOCK_SIZE); // Free list points to the next block
      expect(memory[ptr]).toBe(NIL); // Allocated block points to NIL
      expect(memory[ptr + 1]).toBe(10); // Size is stored in the first block
    });

    it("should allocate multiple contiguous blocks", () => {
      const ptr = malloc(memory, heap, 32); // Request 32 bytes (2 blocks)
      expect(ptr).toBe(HEAP); // First block is allocated
      expect(heap.freeList).toBe(HEAP + 2 * BLOCK_SIZE); // Free list points to the next available block
      expect(memory[ptr]).toBe(HEAP + BLOCK_SIZE); // First block points to the second block
      expect(memory[HEAP + BLOCK_SIZE]).toBe(NIL); // Second block points to NIL
      expect(memory[ptr + 1]).toBe(32); // Size is stored in the first block
    });

    it("should return NIL if not enough memory is available", () => {
      // Allocate all memory
      malloc(memory, heap, HEAP_SIZE);
      const ptr = malloc(memory, heap, BLOCK_SIZE);
      expect(ptr).toBe(NIL); // No memory left
    });

    it("should handle allocating zero bytes", () => {
      const ptr = malloc(memory, heap, 0); // Request 0 bytes
      expect(ptr).toBe(NIL); // No blocks should be allocated
    });

    it("should handle allocating more than available memory", () => {
      const ptr = malloc(memory, heap, MEMORY_SIZE + BLOCK_SIZE); // Request more than available
      expect(ptr).toBe(NIL); // Not enough memory
    });

    it("should roll back partially allocated blocks if not enough memory is available", () => {
      // Allocate almost all memory
      const ptr1 = malloc(memory, heap, HEAP_SIZE - BLOCK_SIZE);
      expect(ptr1).toBe(HEAP); // Allocate all but one block

      // Try to allocate more memory than is available
      const ptr2 = malloc(memory, heap, BLOCK_SIZE * 2); // Request 2 blocks, but only 1 is available
      expect(ptr2).toBe(NIL); // Allocation should fail

      // Verify that the free list is restored
      expect(heap.freeList).toBe(HEAP + HEAP_SIZE - BLOCK_SIZE); // Free list points to the last block
    });
  });

  describe("free", () => {
    it("should free a single block", () => {
      const ptr = malloc(memory, heap, 10); // Allocate 1 block
      free(memory, heap, ptr); // Free the block
      expect(heap.freeList).toBe(HEAP); // Freed block is added back to the free list
      expect(memory[ptr]).toBe(HEAP + BLOCK_SIZE); // Freed block points to the next free block
    });

    it("should free multiple contiguous blocks", () => {
      const ptr = malloc(memory, heap, 32); // Allocate 2 blocks
      free(memory, heap, ptr); // Free the blocks
      expect(heap.freeList).toBe(HEAP); // Freed blocks are added back to the free list
      expect(memory[ptr]).toBe(HEAP + BLOCK_SIZE); // First freed block points to the second
      expect(memory[HEAP + BLOCK_SIZE]).toBe(HEAP + 2 * BLOCK_SIZE); // Second freed block points to the next free block
    });

    it("should handle freeing NIL pointers", () => {
      expect(() => free(memory, heap, NIL)).not.toThrow(); // Freeing NIL should do nothing
    });

    it("should handle freeing already freed blocks", () => {
      const ptr = malloc(memory, heap, 10); // Allocate 1 block
      free(memory, heap, ptr); // Free the block
      expect(() => free(memory, heap, ptr)).not.toThrow(); // Freeing again should do nothing
    });
  });

  describe("integration tests", () => {
    it("should allocate and free memory correctly", () => {
      const ptr1 = malloc(memory, heap, 10); // Allocate 1 block
      const ptr2 = malloc(memory, heap, 20); // Allocate 2 blocks
      expect(ptr1).toBe(HEAP); // First allocation starts at heap start
      expect(ptr2).toBe(HEAP + BLOCK_SIZE); // Second allocation starts at the next block

      free(memory, heap, ptr2); // Free the second allocation
      free(memory, heap, ptr1); // Free the first allocation

      const ptr3 = malloc(memory, heap, 30); // Allocate 2 blocks again
      expect(ptr3).toBe(HEAP); // Reuse the freed blocks
    });

    it("should handle fragmentation", () => {
      malloc(memory, heap, 16); // Allocate 1 block
      const ptr2 = malloc(memory, heap, 16); // Allocate another block
      malloc(memory, heap, 16); // Allocate another block

      free(memory, heap, ptr2); // Free the middle block

      const ptr4 = malloc(memory, heap, 32); // Allocate 2 blocks
      expect(ptr4).not.toBe(NIL); // Allocation should succeed
      expect(heap.freeList).not.toBe(ptr4); // Free list should not point to the allocated block
    });

    it("should handle allocating all memory and then freeing it", () => {
      // Allocate all memory
      const ptr1 = malloc(memory, heap, HEAP_SIZE);
      expect(ptr1).toBe(HEAP); // All memory is allocated

      // Free all memory
      free(memory, heap, ptr1);
      expect(heap.freeList).toBe(HEAP); // Free list is restored to the beginning

      // Allocate again
      const ptr2 = malloc(memory, heap, 16);
      expect(ptr2).toBe(HEAP); // Reuse the freed memory
    });
  });
});
