import { NIL } from "./constants";
import { BLOCK_NEXT, BLOCK_SIZE, Heap, USABLE_BLOCK_SIZE } from "./heap";
import { HEAP, HEAP_SIZE, Memory } from "./memory";

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
    const usableSizePerBlock = BLOCK_SIZE - 2; // Account for BLOCK_NEXT overhead
    const startBlock = heap.malloc(usableSizePerBlock);
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

  it("should handle multiple allocations and frees", () => {
    const initialFreeMemory = heap.available();

    // Allocate three blocks
    const block1 = heap.malloc(USABLE_BLOCK_SIZE / 2); // Allocate 63 bytes (requires one block)
    const block2 = heap.malloc(USABLE_BLOCK_SIZE); // Allocate 126 bytes (requires one block)
    const block3 = heap.malloc(USABLE_BLOCK_SIZE * 2); // Allocate 252 bytes (requires two blocks)
    expect(block1).not.toBe(NIL);
    expect(block2).not.toBe(NIL);
    expect(block3).not.toBe(NIL);

    // Check that available memory is reduced by 4 blocks (1 + 1 + 2)
    expect(heap.available()).toBe(initialFreeMemory - 4 * BLOCK_SIZE);

    // Free two blocks
    heap.free(block1);
    heap.free(block3);

    // Check that available memory is increased by 3 blocks (1 + 2)
    expect(heap.available()).toBe(initialFreeMemory - BLOCK_SIZE); // Only block2 (1 block) remains allocated

    // Free the remaining block
    heap.free(block2);

    // Check that available memory is back to initial value
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
});
