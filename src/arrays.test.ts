import { Memory } from "./memory";
import { BLOCK_SIZE, Heap } from "./heap";
import { NIL } from "./constants";
import {
  arrayCreate,
  arrayRead,
  arrayLength,
  arrayPrint,
  arrayGet,
  arrayUpdate,
} from "./arrays";

describe("arrays.ts", () => {
  let memory: Memory;
  let heap: Heap;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  test("should create and read an array", () => {
    const arr = [1.1, 2.2, 3.3];
    const startBlock = arrayCreate(heap, arr);
    expect(startBlock).not.toBe(NIL);

    const result = arrayRead(memory, startBlock);
    expect(result.length).toBe(arr.length); // Check array length

    // Compare each element with toBeCloseTo
    for (let i = 0; i < arr.length; i++) {
      expect(result[i]).toBeCloseTo(arr[i], 5); // Compare with 5 decimal places
    }
  });
  
  test("should handle array length correctly", () => {
    const arr = [1.1, 2.2, 3.3];
    const startBlock = arrayCreate(heap, arr);
    expect(arrayLength(memory, startBlock)).toBe(arr.length);
  });

  test("should return NIL when array creation fails", () => {
    // Fill the heap to force allocation failure
    while (heap.malloc(BLOCK_SIZE) !== NIL) {}
    const arr = [1.1, 2.2, 3.3];
    const startBlock = arrayCreate(heap, arr);
    expect(startBlock).toBe(NIL);
  });

  test("should print an array", () => {
    const arr = [1.1, 2.2, 3.3];
    const startBlock = arrayCreate(heap, arr);
    const consoleSpy = jest.spyOn(console, "log");
    arrayPrint(memory, startBlock);
    expect(consoleSpy).toHaveBeenCalledWith(arr);
    consoleSpy.mockRestore();
  });

  test("should get an element from an array", () => {
    const arr = [1.1, 2.2, 3.3];
    const startBlock = arrayCreate(heap, arr);
    expect(arrayGet(memory, startBlock, 0)).toBeCloseTo(1.1);
    expect(arrayGet(memory, startBlock, 1)).toBeCloseTo(2.2);
    expect(arrayGet(memory, startBlock, 2)).toBeCloseTo(3.3);
    expect(arrayGet(memory, startBlock, 3)).toBeUndefined();
  });

  test("should update an element in an array", () => {
    const arr = [1.1, 2.2, 3.3];
    const startBlock = arrayCreate(heap, arr);
    arrayUpdate(memory, startBlock, 1, 4.4);
    const expected = [1.1, 4.4, 3.3];
    const result = arrayRead(memory, startBlock);;
    result.every((value, index) => {expect(value).toBeCloseTo(expected[index]);});
  });

  test("should handle arrays spanning multiple blocks", () => {
    const arr = new Array((BLOCK_SIZE / 4) * 3).fill(1.1); // Create a long array spanning 3 blocks
    const startBlock = arrayCreate(heap, arr);
    const result = arrayRead(memory, startBlock);;
    result.every((value, index) => {expect(value).toBeCloseTo(arr[index]);});
    expect(arrayLength(memory, startBlock)).toBe(arr.length);
  });

  test("should handle update on arrays spanning multiple blocks", () => {
    const arr = new Array((BLOCK_SIZE / 4) * 3).fill(1.1); // Create a long array spanning 3 blocks
    const startBlock = arrayCreate(heap, arr);

    // Update an element in the second block
    const updateIndex = Math.floor(BLOCK_SIZE / 4) + 1;
    arrayUpdate(memory, startBlock, updateIndex, 2.2);
    const result = arrayRead(memory, startBlock);
    expect(result[updateIndex]).toBeCloseTo(2.2);
    expect(result).toHaveLength(arr.length);
  });

  test("should gracefully handle update out of bounds", () => {
    const arr = [1.1, 2.2, 3.3];
    const startBlock = arrayCreate(heap, arr);

    expect(() => {
      arrayUpdate(memory, startBlock, 10, 4.4);
    }).toThrow("Index out of bounds");
  });
});
