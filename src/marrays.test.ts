import { NIL } from "./constants";
import { BLOCK_SIZE, Heap } from "./heap";
import {
  arrayCreate,
  arrayGet,
  arrayUpdate,
  MAX_DIMENSIONS,
  ARR_DIM,
  ARR_STRIDES,
} from "./marrays";
import { Memory } from "./memory";

describe("Array Functions", () => {
  let heap: Heap;
  let memory: Memory;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  describe("arrayCreate", () => {
    it("should create 1D array", () => {
      const startBlock = arrayCreate(heap, [3], [1, 2, 3]);
      expect(startBlock).not.toBe(NIL);

      // Verify metadata
      expect(memory.read16(startBlock + ARR_DIM)).toBe(1);
    });

    it("should create 2D array with correct strides", () => {
      const startBlock = arrayCreate(heap, [2, 3], [1, 2, 3, 4, 5, 6]);
      expect(memory.read16(startBlock + ARR_STRIDES)).toBe(3); // Stride for first dimension
    });

    it("should create 3D array with correct strides", () => {
      const startBlock = arrayCreate(heap, [2, 3, 4], new Array(24).fill(0));
      expect(memory.read16(startBlock + ARR_STRIDES)).toBe(12); // 3*4
      expect(memory.read16(startBlock + ARR_STRIDES + 2)).toBe(4); // 4
    });

    it("should handle maximum dimensions", () => {
      const shape = new Array(MAX_DIMENSIONS).fill(2);
      expect(() => arrayCreate(heap, shape, [])).not.toThrow();
    });

    it("should throw for too many dimensions", () => {
      const shape = new Array(MAX_DIMENSIONS + 1).fill(2);
      expect(() => arrayCreate(heap, shape, [])).toThrow(/exceeds maximum/);
    });

    it("should return NIL when allocation fails", () => {
      // Fill the heap
      while (heap.malloc(BLOCK_SIZE) !== NIL) {}
      const startBlock = arrayCreate(heap, [10], new Array(10).fill(0));
      expect(startBlock).toBe(NIL);
    });

    xit("should handle multi-block arrays", () => {
      // Create array needing multiple blocks (BLOCK_SIZE = 1024)
      const elementsPerBlock = Math.floor((BLOCK_SIZE - 18) / 4); // 18 bytes header
      const bigArray = new Array(elementsPerBlock + 10).fill(42);

      const startBlock = arrayCreate(heap, [1], bigArray);
      expect(startBlock).not.toBe(NIL);

      // Verify data in second block
      const secondBlock = memory.read16(startBlock + BLOCK_SIZE - 2);
      expect(memory.readFloat(secondBlock)).toBe(42);
    });
  });

  describe("arrayGet", () => {
    it("should handle out-of-bounds access", () => {
      const startBlock = arrayCreate(heap, [3], [1, 2, 3]);
      expect(arrayGet(memory, startBlock, [3])).toBe(0);
    });

    it("should handle invalid indices count", () => {
      const startBlock = arrayCreate(heap, [2, 3], [1, 2, 3, 4, 5, 6]);
      expect(() => arrayGet(memory, startBlock, [1])).toThrow(
        /Expected 2 indices/
      );
    });

    xit("should access elements in multi-block arrays", () => {
      const elementsPerBlock = Math.floor((BLOCK_SIZE - 18) / 4);
      const bigArray = new Array(elementsPerBlock + 5).fill(0).map((_, i) => i);

      const startBlock = arrayCreate(heap, [1], bigArray);
      expect(arrayGet(memory, startBlock, [elementsPerBlock + 4])).toBe(
        elementsPerBlock + 4
      );
    });
  });

  describe("arrayUpdate", () => {
    it("should throw on out-of-bounds update", () => {
      const startBlock = arrayCreate(heap, [3], [1, 2, 3]);
      expect(() => arrayUpdate(memory, startBlock, [3], 42)).toThrow(
        /out of bounds/
      );
    });

    it("should update elements in multi-block arrays", () => {
      const elementsPerBlock = Math.floor((BLOCK_SIZE - 18) / 4);
      const bigArray = new Array(elementsPerBlock + 5).fill(0);

      const startBlock = arrayCreate(heap, [1], bigArray);
      arrayUpdate(memory, startBlock, [elementsPerBlock + 3], 99);
      expect(arrayGet(memory, startBlock, [elementsPerBlock + 3])).toBe(99);
    });

    it("should handle invalid indices count", () => {
      const startBlock = arrayCreate(heap, [2, 3], [1, 2, 3, 4, 5, 6]);
      expect(() => arrayUpdate(memory, startBlock, [1], 42)).toThrow(
        /Expected 2 indices/
      );
    });
  });

  describe("edge cases", () => {
    xit("should handle empty array", () => {
      const startBlock = arrayCreate(heap, [0], []);
      expect(startBlock).not.toBe(NIL);
      expect(arrayGet(memory, startBlock, [0])).toBeUndefined();
    });

    it("should handle single-element array", () => {
      const startBlock = arrayCreate(heap, [1], [42]);
      expect(arrayGet(memory, startBlock, [0])).toBe(42);
    });

    it("should handle full block utilization", () => {
      const elementsPerBlock = Math.floor((BLOCK_SIZE - 18) / 4);
      const exactFitArray = new Array(elementsPerBlock).fill(42);

      const startBlock = arrayCreate(heap, [1], exactFitArray);
      expect(arrayGet(memory, startBlock, [elementsPerBlock - 1])).toBe(42);
    });
  });
});
