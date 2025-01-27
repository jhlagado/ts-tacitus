import { BLOCK_NEXT, BLOCK_SIZE, Heap } from "./heap";
import { Memory, HEAP, HEAP_SIZE } from "./memory"; 
import { NIL } from "./constants"; 

describe("Heap", () => {
  let memory: Memory;
  let heap: Heap;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory); // Initialize heap
  });

  // Test 1: Heap Initialization
  describe("Initialization", () => {
    it("should initialize the heap with the correct start address", () => {
      expect(heap.freeList).toBe(HEAP);
    });

    it("should initialize the free list correctly", () => {
      let current = heap.freeList;
      let blockCount = 0;

      while (current !== NIL) {
        blockCount++;
        current = memory.read16(current + BLOCK_NEXT); // Use BLOCK_NEXT for traversal
      }

      expect(blockCount).toBe(HEAP_SIZE / BLOCK_SIZE); // All blocks should be in the free list
    });
  });

  // Test 2: malloc
  describe("malloc", () => {
    it("should allocate a single block", () => {
      const ptr = heap.malloc(10); // Request 10 bytes (1 block)
      expect(ptr).toBe(HEAP); // First block is allocated
      expect(heap.freeList).toBe(HEAP + BLOCK_SIZE); // Free list points to the next block
      expect(memory.read16(ptr + BLOCK_NEXT)).toBe(NIL); // Allocated block points to NIL
    });

    it("should allocate multiple contiguous blocks", () => {
      const doubleSize = BLOCK_SIZE * 2;
      const ptr = heap.malloc(doubleSize); // Request 128 bytes (2 blocks)
      expect(ptr).toBe(HEAP); // First block is allocated
      expect(heap.freeList).toBe(HEAP + doubleSize); // Free list points to the next available block
      expect(memory.read16(ptr + BLOCK_NEXT)).toBe(HEAP + BLOCK_SIZE); // First block points to the second
      expect(memory.read16(HEAP + BLOCK_SIZE + BLOCK_NEXT)).toBe(NIL); // Second block points to NIL
    });

    it("should return NIL if not enough memory is available", () => {
      // Allocate all memory
      heap.malloc(HEAP_SIZE);
      const ptr = heap.malloc(BLOCK_SIZE);
      expect(ptr).toBe(NIL); // No memory left
    });

    it("should return NIL if size is zero or negative", () => {
      const ptr1 = heap.malloc(0); // Request 0 bytes
      expect(ptr1).toBe(NIL);

      const ptr2 = heap.malloc(-10); // Request negative size
      expect(ptr2).toBe(NIL);
    });

    it("should roll back partially allocated blocks if not enough memory is available", () => {
      // Allocate almost all memory
      const ptr1 = heap.malloc(HEAP_SIZE - BLOCK_SIZE);
      expect(ptr1).toBe(HEAP); // Allocate all but one block

      // Try to allocate more memory than is available
      const ptr2 = heap.malloc(BLOCK_SIZE * 2); // Request 2 blocks, but only 1 is available
      expect(ptr2).toBe(NIL); // Allocation should fail

      // Verify that the free list is restored
      expect(heap.freeList).toBe(HEAP + HEAP_SIZE - BLOCK_SIZE); // Free list points to the last block
    });
  });

  // Test 3: free
  describe("free", () => {
    it("should free a single block", () => {
      const ptr = heap.malloc(10); // Allocate 1 block
      heap.free(ptr); // Free the block
      expect(heap.freeList).toBe(HEAP); // Freed block is added back to the free list
      expect(memory.read16(ptr + BLOCK_NEXT)).toBe(HEAP + BLOCK_SIZE); // Freed block points to the next free block
    });

    it("should free multiple contiguous blocks", () => {
      const ptr = heap.malloc(128); // Allocate 2 blocks
      heap.free(ptr); // Free the blocks
      expect(heap.freeList).toBe(HEAP); // Freed blocks are added back to the free list
      expect(memory.read16(ptr + BLOCK_NEXT)).toBe(HEAP + BLOCK_SIZE); // First freed block points to the second
      expect(memory.read16(HEAP + BLOCK_SIZE + BLOCK_NEXT)).toBe(
        HEAP + 2 * BLOCK_SIZE
      ); // Second freed block points to the next free block
    });

    it("should handle freeing NIL pointers", () => {
      expect(() => heap.free(NIL)).not.toThrow(); // Freeing NIL should do nothing
    });

    it("should handle freeing already freed blocks", () => {
      const ptr = heap.malloc(10); // Allocate 1 block
      heap.free(ptr); // Free the block
      expect(() => heap.free(ptr)).not.toThrow(); // Freeing again should do nothing
    });
  });

  // Test 4: Integration Tests
  describe("Integration Tests", () => {
    it("should allocate and free memory correctly", () => {
      const ptr1 = heap.malloc(10); // Allocate 1 block
      const ptr2 = heap.malloc(20); // Allocate 2 blocks
      expect(ptr1).toBe(HEAP); // First allocation starts at heap start
      expect(ptr2).toBe(HEAP + BLOCK_SIZE); // Second allocation starts at the next block

      heap.free(ptr2); // Free the second allocation
      heap.free(ptr1); // Free the first allocation

      const ptr3 = heap.malloc(30); // Allocate 2 blocks again
      expect(ptr3).toBe(HEAP); // Reuse the freed blocks
    });

    it("should handle fragmentation", () => {
      heap.malloc(16); // Allocate 1 block
      const ptr2 = heap.malloc(16); // Allocate another block
      heap.malloc(16); // Allocate another block

      heap.free(ptr2); // Free the middle block

      const ptr4 = heap.malloc(32); // Allocate 2 blocks
      expect(ptr4).not.toBe(NIL); // Allocation should succeed
      expect(heap.freeList).not.toBe(ptr4); // Free list should not point to the allocated block
    });

    it("should handle allocating all memory and then freeing it", () => {
      // Allocate all memory
      const ptr1 = heap.malloc(HEAP_SIZE);
      expect(ptr1).toBe(HEAP); // All memory is allocated

      // Free all memory
      heap.free(ptr1);
      expect(heap.freeList).toBe(HEAP); // Free list is restored to the beginning

      // Allocate again
      const ptr2 = heap.malloc(16);
      expect(ptr2).toBe(HEAP); // Reuse the freed memory
    });
  });
});
