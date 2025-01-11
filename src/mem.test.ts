import {
  BLOCK_SIZE,
  MEMORY_SIZE,
  NIL,
  initializeMemory,
  malloc,
  free,
  Memory,
} from "./mem";

describe("Memory Allocator", () => {
  let memory: Memory;

  beforeEach(() => {
    memory = initializeMemory();
  });

  describe("initializeMemory", () => {
    it("should initialize memory with a free list", () => {
      expect(memory.freeList).toBe(0); // Free list starts at the first block
      expect(memory.data[0]).toBe(16); // First block points to the second block
      expect(memory.data[16]).toBe(32); // Second block points to the third block
      expect(memory.data[MEMORY_SIZE - BLOCK_SIZE]).toBe(NIL); // Last block points to NIL
    });

    it("should have the correct number of blocks", () => {
      let blockCount = 0;
      let current = memory.freeList;
      while (current !== NIL) {
        blockCount++;
        current = memory.data[current];
      }
      const expectedBlocks = MEMORY_SIZE / BLOCK_SIZE;
      expect(blockCount).toBe(expectedBlocks); // All blocks should be in the free list
    });
  });

  describe("malloc", () => {
    it("should allocate a single block", () => {
      const ptr = malloc(memory, 10); // Request 10 bytes (1 block)
      expect(ptr).toBe(0); // First block is allocated
      expect(memory.freeList).toBe(16); // Free list points to the next block
      expect(memory.data[ptr]).toBe(NIL); // Allocated block points to NIL
      expect(memory.data[ptr + 1]).toBe(10); // Size is stored in the first block
    });

    it("should allocate multiple contiguous blocks", () => {
      const ptr = malloc(memory, 32); // Request 32 bytes (2 blocks)
      expect(ptr).toBe(0); // First block is allocated
      expect(memory.freeList).toBe(32); // Free list points to the next available block
      expect(memory.data[ptr]).toBe(16); // First block points to the second block
      expect(memory.data[16]).toBe(NIL); // Second block points to NIL
      expect(memory.data[ptr + 1]).toBe(32); // Size is stored in the first block
    });

    it("should return NIL if not enough memory is available", () => {
      // Allocate all memory
      malloc(memory, MEMORY_SIZE);
      const ptr = malloc(memory, BLOCK_SIZE);
      expect(ptr).toBe(NIL); // No memory left
    });

    it("should handle allocating zero bytes", () => {
      const ptr = malloc(memory, 0); // Request 0 bytes
      expect(ptr).toBe(NIL); // No blocks should be allocated
    });

    it("should handle allocating more than available memory", () => {
      const ptr = malloc(memory, MEMORY_SIZE + BLOCK_SIZE); // Request more than available
      expect(ptr).toBe(NIL); // Not enough memory
    });

    it("should roll back partially allocated blocks if not enough memory is available", () => {
      // Allocate almost all memory
      const ptr1 = malloc(memory, MEMORY_SIZE - BLOCK_SIZE);
      expect(ptr1).toBe(0); // Allocate all but one block

      // Try to allocate more memory than is available
      const ptr2 = malloc(memory, BLOCK_SIZE * 2); // Request 2 blocks, but only 1 is available
      expect(ptr2).toBe(NIL); // Allocation should fail

      // Verify that the free list is restored
      expect(memory.freeList).toBe(MEMORY_SIZE - BLOCK_SIZE); // Free list points to the last block
    });
  });

  describe("free", () => {
    it("should free a single block", () => {
      const ptr = malloc(memory, 10); // Allocate 1 block
      free(memory, ptr); // Free the block
      expect(memory.freeList).toBe(0); // Freed block is added back to the free list
      expect(memory.data[ptr]).toBe(16); // Freed block points to the next free block
    });

    it("should free multiple contiguous blocks", () => {
      const ptr = malloc(memory, 32); // Allocate 2 blocks
      free(memory, ptr); // Free the blocks
      console.log({ ptr });

      expect(memory.freeList).toBe(0); // Freed blocks are added back to the free list
      expect(memory.data[ptr]).toBe(16); // First freed block points to the second
      expect(memory.data[16]).toBe(32); // Second freed block points to the next free block
    });

    it("should handle freeing NIL pointers", () => {
      expect(() => free(memory, NIL)).not.toThrow(); // Freeing NIL should do nothing
    });

    it("should handle freeing already freed blocks", () => {
      const ptr = malloc(memory, 10); // Allocate 1 block
      free(memory, ptr); // Free the block
      expect(() => free(memory, ptr)).not.toThrow(); // Freeing again should do nothing
    });
  });

  describe("integration tests", () => {
    it("should allocate and free memory correctly", () => {
      const ptr1 = malloc(memory, 10); // Allocate 1 block
      const ptr2 = malloc(memory, 20); // Allocate 2 blocks
      expect(ptr1).toBe(0); // First allocation starts at block 0
      expect(ptr2).toBe(16); // Second allocation starts at block 16

      free(memory, ptr2); // Free the second allocation
      free(memory, ptr1); // Free the first allocation

      const ptr3 = malloc(memory, 30); // Allocate 2 blocks again
      expect(ptr3).toBe(0); // Reuse the freed blocks
    });

    it("should handle fragmentation", () => {
      malloc(memory, 16); // Allocate 1 block
      const ptr2 = malloc(memory, 16); // Allocate another block
      malloc(memory, 16); // Allocate another block

      free(memory, ptr2); // Free the middle block

      const ptr4 = malloc(memory, 32); // Allocate 2 blocks
      expect(ptr4).not.toBe(NIL); // Allocation should succeed
      expect(memory.freeList).not.toBe(ptr4); // Free list should not point to the allocated block
    });

      it("should handle allocating all memory and then freeing it", () => {
        // Allocate all memory
        const ptr1 = malloc(memory, MEMORY_SIZE);
        expect(ptr1).toBe(0); // All memory is allocated

        // Free all memory
        free(memory, ptr1);
        expect(memory.freeList).toBe(0); // Free list is restored to the beginning

        // Allocate again
        const ptr2 = malloc(memory, 16);
        expect(ptr2).toBe(0); // Reuse the freed memory
      });
  });
});
