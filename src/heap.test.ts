import { NIL } from "./constants";
import { BLOCK_NEXT, BLOCK_REFS, BLOCK_SIZE, Heap, USABLE_BLOCK_SIZE } from "./heap";
import { Memory, HEAP_SIZE } from "./memory";

describe("Heap", () => {
  let heap: Heap;
  let memory: Memory;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  it("should allocate and free blocks correctly", () => {
    const block1 = heap.malloc(64);
    expect(block1).not.toBe(NIL);

    const block2 = heap.malloc(64);
    expect(block2).not.toBe(NIL);

    heap.free(block1);
    heap.free(block2);

    const block3 = heap.malloc(128);
    expect(block3).not.toBe(NIL);
  });

  it("should handle allocation with block overhead", () => {
    const startBlock = heap.malloc(USABLE_BLOCK_SIZE);
    expect(startBlock).not.toBe(NIL);

    // Verify that the next block is NIL (only one block should be allocated)
    const nextBlock = memory.read16(startBlock + BLOCK_NEXT);
    expect(nextBlock).toBe(NIL);

    // Free the block
    heap.free(startBlock);
  });

  it("should return the total heap size initially", () => {
    // Initially, the entire heap is free
    expect(heap.available()).toBe(HEAP_SIZE);
  });

  it("should reduce available memory after allocation", () => {
    const initialFreeMemory = heap.available();

    // Allocate one block
    const allocatedBlock = heap.malloc(64); // Allocate 64 bytes (requires one block)
    expect(allocatedBlock).not.toBe(NIL);

    // Check that available memory is reduced by USABLE_BLOCK_SIZE
    expect(heap.available()).toBe(initialFreeMemory - BLOCK_SIZE);
  });

  it("should increase available memory after freeing", () => {
    const initialFreeMemory = heap.available();

    // Allocate one block
    const allocatedBlock = heap.malloc(64); // Allocate 64 bytes (requires one block)
    expect(allocatedBlock).not.toBe(NIL);

    // Free the allocated block
    heap.free(allocatedBlock);

    // Check that available memory is restored to the initial value
    expect(heap.available()).toBe(initialFreeMemory);
  });

  it("should return 0 if the heap is fully allocated", () => {
    // Allocate all blocks in the heap
    while (heap.malloc(USABLE_BLOCK_SIZE) !== NIL) {}

    // Check that available memory is 0
    expect(heap.available()).toBe(0);
  });

  it("should restore available memory after freeing all blocks", () => {
    const initialFreeMemory = heap.available();

    // Allocate all blocks in the heap
    const allocatedBlocks: number[] = [];
    let block = heap.malloc(USABLE_BLOCK_SIZE);
    while (block !== NIL) {
      allocatedBlocks.push(block);
      block = heap.malloc(USABLE_BLOCK_SIZE);
    }

    // Free all allocated blocks
    for (const block of allocatedBlocks) {
      heap.free(block);
    }

    // Check that available memory is restored to the initial value
    expect(heap.available()).toBe(initialFreeMemory);
  });

  // Additional tests to cover specific lines

  it("should handle allocation of zero or negative size", () => {
    const block = heap.malloc(0);
    expect(block).toBe(NIL);

    const negativeBlock = heap.malloc(-10);
    expect(negativeBlock).toBe(NIL);
  });

  it("should handle freeing NIL pointer", () => {
    heap.free(NIL);
    // No assertion needed, just ensure no error is thrown
  });

  it("should handle freeing a block and re-allocating it", () => {
    const block = heap.malloc(64);
    expect(block).not.toBe(NIL);

    heap.free(block);

    const newBlock = heap.malloc(64);
    expect(newBlock).toBe(block);
  });

  describe("Heap (with Reference Counting)", () => {
    let heap: Heap;
    let memory: Memory;

    beforeEach(() => {
      memory = new Memory();
      heap = new Heap(memory);
    });

    it("should allocate and free blocks with reference counts", () => {
      const initialFree = heap.available();
      const block = heap.malloc(64);

      expect(block).not.toBe(NIL);
      expect(memory.read16(block + BLOCK_REFS)).toBe(1); // BLOCK_REFS

      heap.decrementRef(block);
      expect(heap.available()).toBe(initialFree); // Block returned to free list
    });

    it("should manage multi-block allocations", () => {
      const block1 = heap.malloc(USABLE_BLOCK_SIZE * 2);
      const block2 = block1 + BLOCK_SIZE; // Physical adjacency

      expect(memory.read16(block1 + BLOCK_REFS)).toBe(1);
      expect(memory.read16(block2 + BLOCK_REFS)).toBe(1);

      heap.decrementRef(block1);
      expect(memory.read16(block2 + BLOCK_REFS)).toBe(0);
    });

    it("should handle shared block references", () => {
      const parent1 = heap.malloc(64);
      const parent2 = heap.malloc(64);
      const child = heap.malloc(64);

      // Link both parents to child
      heap.setNextBlock(parent1, child);
      heap.setNextBlock(parent2, child);

      expect(memory.read16(child + BLOCK_REFS)).toBe(3); // 1 alloc+ BLOCK_REFS refs

      heap.decrementRef(parent1);
      expect(memory.read16(child + BLOCK_REFS)).toBe(2);

      heap.decrementRef(parent2);
      expect(memory.read16(child + BLOCK_REFS)).toBe(1);
    });

    it("should copy-on-write when sharing blocks", () => {
      // Allocate original structure: A -> B -> C
      const blockA = heap.malloc(64);
      const blockB = heap.malloc(64);
      const blockC = heap.malloc(64);

      heap.setNextBlock(blockA, blockB);
      heap.setNextBlock(blockB, blockC);

      // Clone blockA for modification
      const newBlockA = heap.malloc(64);
      memory.buffer.copyWithin(newBlockA, blockA, blockA + BLOCK_SIZE);
      heap.setNextBlock(newBlockA, blockB);

      // Original ref counts: B=2, C=1
      expect(memory.read16(blockB + BLOCK_REFS)).toBe(2);

      // Modify newBlockA's next pointer
      const newBlockB = heap.malloc(64);
      heap.setNextBlock(newBlockA, newBlockB);

      // Release test's reference to newBlockB - this is crucial!
      heap.decrementRef(newBlockB);

      // Verify original blocks unchanged
      expect(memory.read16(blockB + BLOCK_REFS)).toBe(1); // Lost one reference
      expect(memory.read16(newBlockB + BLOCK_REFS)).toBe(1); // Now correct
    });

    it("should maintain available space correctly", () => {
      const initial = heap.available();
      const block = heap.malloc(64);

      expect(heap.available()).toBe(initial - BLOCK_SIZE);

      heap.incrementRef(block);
      heap.decrementRef(block); // Refcount back to 1
      expect(heap.available()).toBe(initial - BLOCK_SIZE);

      heap.decrementRef(block); // Refcount 0
      expect(heap.available()).toBe(initial);
    });

    it("should handle complex reference scenarios", () => {
      const createStructure = () => {
        const a = heap.malloc(64);
        const b = heap.malloc(64);
        const c = heap.malloc(64);
        heap.setNextBlock(a, b);
        heap.setNextBlock(b, c);
        return a;
      };

      const struct1 = createStructure();
      const struct2 = createStructure();

      // Share node B between both structures
      const sharedB = heap.malloc(64);
      heap.setNextBlock(struct1, sharedB);
      heap.setNextBlock(struct2, sharedB);

      expect(memory.read16(sharedB + BLOCK_REFS)).toBe(3); // 1 alloc + two refs

      heap.decrementRef(struct1);
      expect(memory.read16(sharedB + BLOCK_REFS)).toBe(2);

      heap.decrementRef(struct2);
      expect(memory.read16(sharedB + BLOCK_REFS)).toBe(1);
    });

    // Preserve original tests with reference counting adaptations
    it("should handle allocation with block overhead", () => {
      const startBlock = heap.malloc(USABLE_BLOCK_SIZE);
      expect(memory.read16(startBlock + BLOCK_REFS)).toBe(1);

      const nextBlock = memory.read16(startBlock);
      expect(nextBlock).toBe(NIL);
    });

    it("should return NIL if allocation fails", () => {
      // Exhaust heap
      while (heap.malloc(USABLE_BLOCK_SIZE) !== NIL) {}

      const block = heap.malloc(64);
      expect(block).toBe(NIL);
    });

    it("should handle freeing invalid pointers", () => {
      heap.decrementRef(12345); // Should do nothing
      expect(heap.available()).toBe(HEAP_SIZE);
    });
  });
});
