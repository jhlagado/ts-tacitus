// File: src/tests/heap.test.ts

import { NULL } from "../constants";
import {
  BLOCK_NEXT,
  BLOCK_REFS,
  BLOCK_SIZE,
  Heap,
  USABLE_BLOCK_SIZE,
} from "./heap";
import { Memory, HEAP_SIZE } from "./memory";

const HALF_BLOCK_SIZE = Math.floor(USABLE_BLOCK_SIZE / 2);

describe("Heap", () => {
  let heap: Heap;
  let memory: Memory;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  it("should allocate and free blocks correctly", () => {
    const block1 = heap.malloc(HALF_BLOCK_SIZE);
    expect(block1).not.toBe(NULL);

    const block2 = heap.malloc(HALF_BLOCK_SIZE);
    expect(block2).not.toBe(NULL);

    heap.free(block1);
    heap.free(block2);

    const block3 = heap.malloc(BLOCK_SIZE);
    expect(block3).not.toBe(NULL);
  });

  it("should handle allocation with block overhead", () => {
    const startBlock = heap.malloc(USABLE_BLOCK_SIZE);
    expect(startBlock).not.toBe(NULL);

    // Verify that the next block is NULL (only one block should be allocated)
    const nextBlock = memory.read16(startBlock + BLOCK_NEXT);
    expect(nextBlock).toBe(NULL);

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
    const allocatedBlock = heap.malloc(60); // Allocate a block worth of data
    expect(allocatedBlock).not.toBe(NULL);

    // Check that available memory is reduced by BLOCK_SIZE
    expect(heap.available()).toBe(initialFreeMemory - BLOCK_SIZE);
  });

  it("should reduce available memory for multi-block allocations", () => {
    const initialFreeMemory = heap.available();

    // Allocate enough bytes to require 2 blocks.
    const allocatedBlock = heap.malloc(BLOCK_SIZE);
    expect(allocatedBlock).not.toBe(NULL);

    // Expect reduction of 2 blocks.
    expect(heap.available()).toBe(initialFreeMemory - 2 * BLOCK_SIZE);
  });

  it("should increase available memory after freeing", () => {
    const initialFreeMemory = heap.available();

    const allocatedBlock = heap.malloc(HALF_BLOCK_SIZE);
    expect(allocatedBlock).not.toBe(NULL);

    heap.free(allocatedBlock);
    expect(heap.available()).toBe(initialFreeMemory);
  });

  it("should return 0 if the heap is fully allocated", () => {
    while (heap.malloc(USABLE_BLOCK_SIZE) !== NULL) {}
    expect(heap.available()).toBe(0);
  });

  it("should restore available memory after freeing all blocks", () => {
    const initialFreeMemory = heap.available();

    const allocatedBlocks: number[] = [];
    let block = heap.malloc(USABLE_BLOCK_SIZE);
    while (block !== NULL) {
      allocatedBlocks.push(block);
      block = heap.malloc(USABLE_BLOCK_SIZE);
    }
    allocatedBlocks.forEach((b) => heap.free(b));
    expect(heap.available()).toBe(initialFreeMemory);
  });

  it("should handle allocation of zero or negative size", () => {
    const block = heap.malloc(0);
    expect(block).toBe(NULL);

    const negativeBlock = heap.malloc(-10);
    expect(negativeBlock).toBe(NULL);
  });

  it("should handle freeing NULL pointer", () => {
    expect(() => heap.free(NULL)).not.toThrow();
  });

  it("should handle freeing a block and re-allocating it", () => {
    const block = heap.malloc(HALF_BLOCK_SIZE);
    expect(block).not.toBe(NULL);
    heap.free(block);
    const newBlock = heap.malloc(HALF_BLOCK_SIZE);
    expect(newBlock).toBe(block);
  });

  // --------------------------
  // Additional tests for copyOnWrite
  // --------------------------
  it("should copyOnWrite clone a block when ref count > 1", () => {
    const ptr = heap.malloc(20);
    expect(ptr).not.toBe(NULL);
    // Manually bump the reference count.
    memory.write16(ptr + BLOCK_REFS, 2);
    const newPtr = heap.copyOnWrite(ptr);
    expect(newPtr).not.toBe(ptr);
    expect(memory.read16(newPtr + BLOCK_REFS)).toBe(1);
  });

  it("should copyOnWrite return same block when ref count is 1", () => {
    const ptr = heap.malloc(20);
    expect(ptr).not.toBe(NULL);
    memory.write16(ptr + BLOCK_REFS, 1);
    const newPtr = heap.copyOnWrite(ptr);
    expect(newPtr).toBe(ptr);
  });

  // --------------------------
  // Tests for reference counting and cloneBlock
  // --------------------------
  describe("Heap (with Reference Counting)", () => {
    beforeEach(() => {
      memory = new Memory();
      heap = new Heap(memory);
    });

    it("should allocate and free blocks with reference counts", () => {
      const initialFree = heap.available();
      const block = heap.malloc(HALF_BLOCK_SIZE);
      expect(block).not.toBe(NULL);
      expect(memory.read16(block + BLOCK_REFS)).toBe(1);
      heap.decrementRef(block);
      expect(heap.available()).toBe(initialFree);
    });

    it("should manage multi-block allocations", () => {
      const block1 = heap.malloc(USABLE_BLOCK_SIZE * 2);
      const block2 = block1 + BLOCK_SIZE;
      expect(memory.read16(block1 + BLOCK_REFS)).toBe(1);
      expect(memory.read16(block2 + BLOCK_REFS)).toBe(1);
      heap.decrementRef(block1);
      expect(memory.read16(block2 + BLOCK_REFS)).toBe(0);
    });

    it("should handle shared block references", () => {
      const parent1 = heap.malloc(HALF_BLOCK_SIZE);
      const parent2 = heap.malloc(HALF_BLOCK_SIZE);
      const child = heap.malloc(HALF_BLOCK_SIZE);
      heap.setNextBlock(parent1, child);
      heap.setNextBlock(parent2, child);
      expect(memory.read16(child + BLOCK_REFS)).toBe(3);
      heap.decrementRef(parent1);
      expect(memory.read16(child + BLOCK_REFS)).toBe(2);
      heap.decrementRef(parent2);
      expect(memory.read16(child + BLOCK_REFS)).toBe(1);
    });

    it("should copy-on-write when sharing blocks", () => {
      const blockA = heap.malloc(HALF_BLOCK_SIZE);
      const blockB = heap.malloc(HALF_BLOCK_SIZE);
      const blockC = heap.malloc(HALF_BLOCK_SIZE);
      heap.setNextBlock(blockA, blockB);
      heap.setNextBlock(blockB, blockC);
      const newBlockA = heap.cloneBlock(blockA);
      expect(newBlockA).not.toBe(NULL);
      expect(memory.read16(newBlockA + BLOCK_REFS)).toBe(1);
    });

    it("should maintain available space correctly", () => {
      const initial = heap.available();
      const block = heap.malloc(HALF_BLOCK_SIZE);
      expect(heap.available()).toBe(initial - BLOCK_SIZE);
      heap.incrementRef(block);
      heap.decrementRef(block);
      expect(heap.available()).toBe(initial - BLOCK_SIZE);
      heap.decrementRef(block);
      expect(heap.available()).toBe(initial);
    });

    it("should handle complex reference scenarios", () => {
      const createStructure = () => {
        const a = heap.malloc(HALF_BLOCK_SIZE);
        const b = heap.malloc(HALF_BLOCK_SIZE);
        const c = heap.malloc(HALF_BLOCK_SIZE);
        heap.setNextBlock(a, b);
        heap.setNextBlock(b, c);
        return a;
      };

      const struct1 = createStructure();
      const struct2 = createStructure();

      const sharedB = heap.malloc(HALF_BLOCK_SIZE);
      heap.setNextBlock(struct1, sharedB);
      heap.setNextBlock(struct2, sharedB);
      expect(memory.read16(sharedB + BLOCK_REFS)).toBe(3);
      heap.decrementRef(struct1);
      expect(memory.read16(sharedB + BLOCK_REFS)).toBe(2);
      heap.decrementRef(struct2);
      expect(memory.read16(sharedB + BLOCK_REFS)).toBe(1);
    });

    it("should return NULL if allocation fails", () => {
      while (heap.malloc(USABLE_BLOCK_SIZE) !== NULL) {}
      const block = heap.malloc(HALF_BLOCK_SIZE);
      expect(block).toBe(NULL);
    });

    it("should handle freeing invalid pointers gracefully", () => {
      // Decrement ref of a bogus pointer (should not crash)
      heap.decrementRef(12345);
      expect(heap.available()).toBe(HEAP_SIZE);
    });
  });
});
