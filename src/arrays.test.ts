import { BLOCK_NEXT, BLOCK_REFS, BLOCK_SIZE, Heap } from "./heap";
import {
  ARR_DATA,
  ARR_DATA2,
  arrayCreate,
  arrayGet,
  arrayUpdate,
  MAX_DIMENSIONS,
} from "./arrays";
import { Memory } from "./memory";
import { NULL } from "./constants";
import { toTagNum, Tag } from "./tagnum";

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
    expect(startBlock).not.toBe(NULL);
    expect(arrayGet(heap, startBlock, [1, 2])).toBe(6);
  });

  it("should update elements in multi-block arrays", () => {
    const shape = [2, 3];
    const data = [1, 2, 3, 4, 5, 6];
    const startBlock = arrayCreate(heap, shape, data);
    arrayUpdate(heap, startBlock, [1, 2], 32);
    expect(arrayGet(heap, startBlock, [1, 2])).toBe(32);
  });

  it("should access elements in multi-block arrays", () => {
    // Calculate elements per block based on actual metadata layout
    const elementsFirstBlock = Math.floor((BLOCK_SIZE - ARR_DATA) / 4); // First block elements
    const elementsSubsequentBlock = Math.floor((BLOCK_SIZE - ARR_DATA2) / 4); // Other blocks

    // Create array that spans exactly 2 blocks
    const testElements = elementsFirstBlock + 1;
    const bigArray = Array.from({ length: testElements }, (_, i) => i);

    // Calculate required blocks based on array layout
    let requiredBlocks = 1;
    let remainingElements = testElements - elementsFirstBlock;
    while (remainingElements > 0) {
      requiredBlocks++;
      remainingElements -= elementsSubsequentBlock;
    }

    // Validate heap capacity
    let availableBlocks = 0;
    let current = heap.freeList;
    while (current !== NULL) {
      availableBlocks++;
      current = heap.memory.read16(current + BLOCK_NEXT);
    }
    if (availableBlocks < requiredBlocks) {
      throw new Error(
        `Need ${requiredBlocks} blocks, only ${availableBlocks} available`
      );
    }

    // Create array
    const startBlock = arrayCreate(heap, [1], bigArray);
    expect(startBlock).not.toBe(NULL);

    // Verify last element in second block
    expect(arrayGet(heap, startBlock, [testElements - 1])).toBe(
      testElements - 1
    );
  });

  it("should create and update a multi-block, single-dimensional array", () => {
    const shape = [20]; // Array of 20 elements
    const data = Array.from({ length: 20 }, (_, i) => i + 1);
    const startBlock = arrayCreate(heap, shape, data);
    expect(startBlock).not.toBe(NULL);

    // Verify the elements using arrayGet
    for (let i = 0; i < 20; i++) {
      expect(arrayGet(heap, startBlock, [i])).toBe(i + 1);
    }

    // Update an element and verify
    arrayUpdate(heap, startBlock, [10], 100); // Update index 10 with value 100
    expect(arrayGet(heap, startBlock, [10])).toBe(100);
  });

  it("should create and update a single block, single-dimensional array", () => {
    const shape = [5]; // Array of 5 elements
    const data = [1, 2, 3, 4, 5];
    const startBlock = arrayCreate(heap, shape, data);
    expect(startBlock).not.toBe(NULL);

    // Verify the elements using arrayGet
    expect(arrayGet(heap, startBlock, [0])).toBe(1);
    expect(arrayGet(heap, startBlock, [1])).toBe(2);
    expect(arrayGet(heap, startBlock, [2])).toBe(3);
    expect(arrayGet(heap, startBlock, [3])).toBe(4);
    expect(arrayGet(heap, startBlock, [4])).toBe(5);

    // Update an element and verify
    arrayUpdate(heap, startBlock, [2], 10); // Update index 2 with value 10
    expect(arrayGet(heap, startBlock, [2])).toBe(10);
  });

  it("should create and update a multi-dimensional array in a single block", () => {
    const shape = [2, 3]; // 2x3 array
    const data = [1, 2, 3, 4, 5, 6];
    const startBlock = arrayCreate(heap, shape, data);
    expect(startBlock).not.toBe(NULL);

    // Verify the elements using arrayGet
    expect(arrayGet(heap, startBlock, [0, 0])).toBe(1);
    expect(arrayGet(heap, startBlock, [0, 1])).toBe(2);
    expect(arrayGet(heap, startBlock, [0, 2])).toBe(3);
    expect(arrayGet(heap, startBlock, [1, 0])).toBe(4);
    expect(arrayGet(heap, startBlock, [1, 1])).toBe(5);
    expect(arrayGet(heap, startBlock, [1, 2])).toBe(6);

    // Update an element and verify
    arrayUpdate(heap, startBlock, [1, 2], 10); // Update [1, 2] with value 10
    expect(arrayGet(heap, startBlock, [1, 2])).toBe(10);
  });

  it("should create and update a multi-block, multi-dimensional array", () => {
    const shape = [4, 5]; // 4x5 array (20 elements)
    const data = Array.from({ length: 20 }, (_, i) => i + 1);
    const startBlock = arrayCreate(heap, shape, data);
    expect(startBlock).not.toBe(NULL);

    // Verify the elements using arrayGet
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 5; j++) {
        expect(arrayGet(heap, startBlock, [i, j])).toBe(i * 5 + j + 1);
      }
    }

    // Update an element and verify
    arrayUpdate(heap, startBlock, [2, 3], 200); // Update [2, 3] with value 200
    expect(arrayGet(heap, startBlock, [2, 3])).toBe(200);
  });

  it("should handle large multi-dimensional arrays spanning multiple blocks", () => {
    const shape = [10, 10]; // 10x10 array (100 elements)
    const data = Array.from({ length: 100 }, (_, i) => i + 1);
    const startBlock = arrayCreate(heap, shape, data);
    expect(startBlock).not.toBe(NULL);

    // Verify the elements using arrayGet
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        expect(arrayGet(heap, startBlock, [i, j])).toBe(i * 10 + j + 1);
      }
    }

    // Update an element and verify
    arrayUpdate(heap, startBlock, [7, 8], 1000); // Update [7, 8] with value 1000
    expect(arrayGet(heap, startBlock, [7, 8])).toBe(1000);
  });

  it("should throw an error if the number of dimensions exceeds MAX_DIMENSIONS", () => {
    const shape = Array.from({ length: MAX_DIMENSIONS + 1 }, () => 2);
    const data = Array.from({ length: 2 ** (MAX_DIMENSIONS + 1) }, (_, i) => i);
    expect(() => arrayCreate(heap, shape, data)).toThrow(
      `Number of dimensions (${shape.length}) exceeds maximum (${MAX_DIMENSIONS}).`
    );
  });

  it("should return NULL if allocation of the first block fails", () => {
    while (heap.malloc(BLOCK_SIZE - 2) !== NULL) {}
    const shape = [2, 3];
    const data = [1, 2, 3, 4, 5, 6];
    const startBlock = arrayCreate(heap, shape, data);
    expect(startBlock).toBe(NULL);
  });

  it("should return NULL if allocation of a subsequent block fails", () => {
    const shape = [1, 20];
    const data = Array.from({ length: 20 }, (_, i) => i + 1);
    while (heap.available() > BLOCK_SIZE) {
      heap.malloc(BLOCK_SIZE - 2);
    }
    const startBlock = arrayCreate(heap, shape, data);
    expect(startBlock).toBe(NULL);
  });

  it("should throw an error if the number of indices does not match the number of dimensions", () => {
    const shape = [2, 3];
    const data = [1, 2, 3, 4, 5, 6];
    const startBlock = arrayCreate(heap, shape, data);
    expect(() => arrayGet(heap, startBlock, [1])).toThrow(
      `Expected ${shape.length} indices, got 1.`
    );
  });

  it("should throw an error if the number of indices does not match the number of dimensions", () => {
    const shape = [2, 3];
    const data = [1, 2, 3, 4, 5, 6];
    const startBlock = arrayCreate(heap, shape, data);
    expect(() => arrayUpdate(heap, startBlock, [1], 10)).toThrow(
      `Expected ${shape.length} indices, got 1.`
    );
  });

  it("should throw an error if the index is out of bounds", () => {
    const shape = [2, 3];
    const data = [1, 2, 3, 4, 5, 6];
    const startBlock = arrayCreate(heap, shape, data);
    expect(() => arrayUpdate(heap, startBlock, [2, 3], 10)).toThrow(
      "Index out of bounds"
    );
  });

  it("should access elements at block boundaries", () => {
    const elementsPerBlock = Math.floor((BLOCK_SIZE - 8) / 4); // Adjust for metadata
    const shape = [elementsPerBlock + 5];
    const data = Array.from({ length: elementsPerBlock + 5 }, (_, i) => i + 1);
    const startBlock = arrayCreate(heap, shape, data);

    // Access first element of the second block
    expect(arrayGet(heap, startBlock, [elementsPerBlock])).toBe(
      elementsPerBlock + 1
    );

    // Access last element of the first block
    expect(arrayGet(heap, startBlock, [elementsPerBlock - 1])).toBe(
      elementsPerBlock
    );
  });

  it("should update elements at block boundaries", () => {
    const elementsPerBlock = Math.floor((BLOCK_SIZE - 8) / 4); // Adjust for metadata
    const shape = [elementsPerBlock + 5];
    const data = Array.from({ length: elementsPerBlock + 5 }, (_, i) => i + 1);
    const startBlock = arrayCreate(heap, shape, data);

    // Update first element of the second block
    arrayUpdate(heap, startBlock, [elementsPerBlock], 999);
    expect(arrayGet(heap, startBlock, [elementsPerBlock])).toBe(999);

    // Update last element of the first block
    arrayUpdate(heap, startBlock, [elementsPerBlock - 1], 888);
    expect(arrayGet(heap, startBlock, [elementsPerBlock - 1])).toBe(888);
  });

  it("should handle TagNum values in arrayUpdate", () => {
    const shape = [2];
    const data = [1, 2];
    const startBlock = arrayCreate(heap, shape, data);

    // Create another array and get its pointer as a TagNum
    const nestedShape = [3];
    const nestedData = [10, 20, 30];
    const nestedArrayPtr = arrayCreate(heap, nestedShape, nestedData);
    const nestedArrayTagNum = toTagNum(Tag.ARRAY, nestedArrayPtr);

    // Update the first element with the TagNum
    arrayUpdate(heap, startBlock, [0], nestedArrayTagNum);

    // Verify the updated value
    const updatedValue = arrayGet(heap, startBlock, [0]);
    expect(updatedValue).toBe(nestedArrayTagNum);
  });

  it("should clone blocks during arrayUpdate when necessary", () => {
    const shape = [2, 3];
    const data = [1, 2, 3, 4, 5, 6];
    const startBlock = arrayCreate(heap, shape, data);

    // Update element and get new startBlock pointer
    const newStartBlock = arrayUpdate(heap, startBlock, [1, 2], 99);

    // Verify using the NEW pointer
    expect(arrayGet(heap, newStartBlock, [1, 2])).toBe(99);

    // Verify original block's refcount dropped to 1
    expect(heap.memory.read16(startBlock + BLOCK_REFS)).toBe(1);
  });
});
