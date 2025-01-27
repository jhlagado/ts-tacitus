import { NIL } from "./constants";
import { BLOCK_NEXT, BLOCK_SIZE, Heap } from "./heap";
import { Memory } from "./memory";

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
});

