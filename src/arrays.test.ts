import { BLOCK_SIZE, Heap } from "./heap";
import { arrayCreate, arrayGet, arrayUpdate, MAX_DIMENSIONS } from "./arrays";
import { Memory } from "./memory";
import { NIL } from "./constants";

describe("Array Functions", () => {
  let memory: Memory;
  let heap: Heap;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  it("should create an array", () => {
    const shape = [2, 3];
    const data = [1, 2, 3, 4, 5, 6];
    const startBlock = arrayCreate(heap, shape, data);
    expect(startBlock).not.toBe(NIL);
    expect(arrayGet(memory, startBlock, [1, 2])).toBe(6);
  });

  it("should update elements in multi-block arrays", () => {
    const shape = [2, 3];
    const data = [1, 2, 3, 4, 5, 6];
    const startBlock = arrayCreate(heap, shape, data);
    arrayUpdate(memory, startBlock, [1, 2], 32);
    expect(arrayGet(memory, startBlock, [1, 2])).toBe(32);
  });

  it("should access elements in multi-block arrays", () => {
    const elementsPerBlock = 10;
    const bigArray = Array.from({ length: elementsPerBlock + 5 }, (_, i) => i);
    const startBlock = arrayCreate(heap, [1], bigArray);
    expect(arrayGet(memory, startBlock, [elementsPerBlock + 4])).toBe(
      elementsPerBlock + 4
    );
  });
  
  describe("Array Functions", () => {
  
    it("should create and update a single block, single-dimensional array", () => {
      const shape = [5]; // Array of 5 elements
      const data = [1, 2, 3, 4, 5];
      const startBlock = arrayCreate(heap, shape, data);
      expect(startBlock).not.toBe(NIL);
  
      // Verify the elements using arrayGet
      expect(arrayGet(memory, startBlock, [0])).toBe(1);
      expect(arrayGet(memory, startBlock, [1])).toBe(2);
      expect(arrayGet(memory, startBlock, [2])).toBe(3);
      expect(arrayGet(memory, startBlock, [3])).toBe(4);
      expect(arrayGet(memory, startBlock, [4])).toBe(5);
  
      // Update an element and verify
      arrayUpdate(memory, startBlock, [2], 10); // Update index 2 with value 10
      expect(arrayGet(memory, startBlock, [2])).toBe(10);
    });
  
    it("should create and update a multi-dimensional array in a single block", () => {
      const shape = [2, 3]; // 2x3 array
      const data = [1, 2, 3, 4, 5, 6];
      const startBlock = arrayCreate(heap, shape, data);
      expect(startBlock).not.toBe(NIL);
  
      // Verify the elements using arrayGet
      expect(arrayGet(memory, startBlock, [0, 0])).toBe(1);
      expect(arrayGet(memory, startBlock, [0, 1])).toBe(2);
      expect(arrayGet(memory, startBlock, [0, 2])).toBe(3);
      expect(arrayGet(memory, startBlock, [1, 0])).toBe(4);
      expect(arrayGet(memory, startBlock, [1, 1])).toBe(5);
      expect(arrayGet(memory, startBlock, [1, 2])).toBe(6);
  
      // Update an element and verify
      arrayUpdate(memory, startBlock, [1, 2], 10); // Update [1, 2] with value 10
      expect(arrayGet(memory, startBlock, [1, 2])).toBe(10);
    });
  
    it("should create and update a multi-block, single-dimensional array", () => {
      const shape = [20]; // Array of 20 elements
      const data = Array.from({ length: 20 }, (_, i) => i + 1);
      const startBlock = arrayCreate(heap, shape, data);
      expect(startBlock).not.toBe(NIL);
  
      // Verify the elements using arrayGet
      for (let i = 0; i < 20; i++) {
        expect(arrayGet(memory, startBlock, [i])).toBe(i + 1);
      }
  
      // Update an element and verify
      arrayUpdate(memory, startBlock, [10], 100); // Update index 10 with value 100
      expect(arrayGet(memory, startBlock, [10])).toBe(100);
    });
  
    it("should create and update a multi-block, multi-dimensional array", () => {
      const shape = [4, 5]; // 4x5 array (20 elements)
      const data = Array.from({ length: 20 }, (_, i) => i + 1);
      const startBlock = arrayCreate(heap, shape, data);
      expect(startBlock).not.toBe(NIL);
  
      // Verify the elements using arrayGet
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 5; j++) {
          expect(arrayGet(memory, startBlock, [i, j])).toBe(i * 5 + j + 1);
        }
      }
  
      // Update an element and verify
      arrayUpdate(memory, startBlock, [2, 3], 200); // Update [2, 3] with value 200
      expect(arrayGet(memory, startBlock, [2, 3])).toBe(200);
    });
  
    it("should handle large multi-dimensional arrays spanning multiple blocks", () => {
      const shape = [10, 10]; // 10x10 array (100 elements)
      const data = Array.from({ length: 100 }, (_, i) => i + 1);
      const startBlock = arrayCreate(heap, shape, data);
      expect(startBlock).not.toBe(NIL);
  
      // Verify the elements using arrayGet
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          expect(arrayGet(memory, startBlock, [i, j])).toBe(i * 10 + j + 1);
        }
      }
  
      // Update an element and verify
      arrayUpdate(memory, startBlock, [7, 8], 1000); // Update [7, 8] with value 1000
      expect(arrayGet(memory, startBlock, [7, 8])).toBe(1000);
    });
  });
  
  it("should throw an error if the number of dimensions exceeds MAX_DIMENSIONS", () => {
    const shape = Array.from({ length: MAX_DIMENSIONS + 1 }, () => 2);
    const data = Array.from({ length: 2 ** (MAX_DIMENSIONS + 1) }, (_, i) => i);

    expect(() => arrayCreate(heap, shape, data)).toThrow(
      `Number of dimensions (${shape.length}) exceeds maximum (${MAX_DIMENSIONS}).`
    );
  });

  it("should return NIL if allocation of the first block fails", () => {
    while (heap.malloc(BLOCK_SIZE - 2) !== NIL) {}

    const shape = [2, 3];
    const data = [1, 2, 3, 4, 5, 6];

    const startBlock = arrayCreate(heap, shape, data);
    expect(startBlock).toBe(NIL);
  });

  it("should return NIL if allocation of a subsequent block fails", () => {
    const shape = [1, 20];
    const data = Array.from({ length: 20 }, (_, i) => i + 1);

    while (heap.available() > BLOCK_SIZE) {
      heap.malloc(BLOCK_SIZE - 2);
    }

    const startBlock = arrayCreate(heap, shape, data);
    expect(startBlock).toBe(NIL);
  });

  it("should throw an error if the number of indices does not match the number of dimensions", () => {
    const shape = [2, 3];
    const data = [1, 2, 3, 4, 5, 6];
    const startBlock = arrayCreate(heap, shape, data);

    expect(() => arrayGet(memory, startBlock, [1])).toThrow(
      `Expected ${shape.length} indices, but got 1.`
    );
  });

  it("should throw an error if the number of indices does not match the number of dimensions", () => {
    const shape = [2, 3];
    const data = [1, 2, 3, 4, 5, 6];
    const startBlock = arrayCreate(heap, shape, data);

    expect(() => arrayUpdate(memory, startBlock, [1], 10)).toThrow(
      `Expected ${shape.length} indices, but got 1.`
    );
  });

  it("should throw an error if the index is out of bounds", () => {
    const shape = [2, 3];
    const data = [1, 2, 3, 4, 5, 6];
    const startBlock = arrayCreate(heap, shape, data);

    expect(() => arrayUpdate(memory, startBlock, [2, 3], 10)).toThrow(
      "Index out of bounds"
    );
  });

  it("should access elements in multi-block arrays", () => {
    const shape = [1, 20];
    const data = Array.from({ length: 20 }, (_, i) => i + 1);
    const startBlock = arrayCreate(heap, shape, data);

    expect(arrayGet(memory, startBlock, [0, 15])).toBe(16);
  });
});
