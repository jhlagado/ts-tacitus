import { BLOCK_SIZE, Heap } from "./heap";
import {
  arrayCreate,
  arrayRead,
  arrayPrint,
  arrayLength,
  arrayUpdate,
  arrayGet,
} from "./arrays";
import { NIL, MEMORY_SIZE } from "./constants";

describe("Arrays Library", () => {
  let heap: Heap;

  beforeEach(() => {
    // Create a fresh heap instance for each test
    heap = new Heap(new Array(MEMORY_SIZE).fill(0));
  });

  it("should create and read an array", () => {
    const arr = arrayCreate(heap, [1, 2, 3, 4, 5]);
    expect(arr).not.toBe(NIL);
    expect(arrayRead(heap, arr)).toEqual([1, 2, 3, 4, 5]);
  });

  it("should print an array", () => {
    const arr = arrayCreate(heap, [1, 2, 3]);
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    arrayPrint(heap, arr);
    expect(consoleSpy).toHaveBeenCalledWith([1, 2, 3]);
    consoleSpy.mockRestore();
  });

  it("should handle empty arrays", () => {
    const arr = arrayCreate(heap, []);
    expect(arr).not.toBe(NIL);
    expect(arrayRead(heap, arr)).toEqual([]);
  });

  it("should handle large arrays", () => {
    const largeArray = new Array(1000).fill(0).map((_, i) => i); // 1000-element array
    const arr = arrayCreate(heap, largeArray);
    expect(arr).not.toBe(NIL);
    expect(arrayRead(heap, arr)).toEqual(largeArray);
  });

  it("should return NIL if allocation fails", () => {
    // Fill the heap to force allocation failure
    while (heap.malloc(BLOCK_SIZE) !== NIL) {}
    const arr = arrayCreate(heap, [1, 2, 3]);
    expect(arr).toBe(NIL);
  });

  // Tests for arrayLength
  describe("arrayLength", () => {
    it("should return the correct length for a short array", () => {
      const arr = arrayCreate(heap, [1, 2, 3]);
      expect(arrayLength(heap, arr)).toBe(3);
    });

    it("should return the correct length for an empty array", () => {
      const arr = arrayCreate(heap, []);
      expect(arrayLength(heap, arr)).toBe(0);
    });

    it("should return the correct length for a long array", () => {
      const longArray = new Array(1000).fill(0).map((_, i) => i); // 1000-element array
      const arr = arrayCreate(heap, longArray);
      expect(arrayLength(heap, arr)).toBe(1000);
    });

    it("should return 0 for an invalid array (NIL)", () => {
      expect(arrayLength(heap, NIL)).toBe(0);
    });
  });

  // Tests for arrayGet
  describe("arrayGet", () => {
    it("should get an element from the array", () => {
      const arr = arrayCreate(heap, [1, 2, 3]);
      expect(arrayGet(heap, arr, 1)).toBe(2);
    });

    it("should return undefined for out-of-bounds index", () => {
      const arr = arrayCreate(heap, [1, 2, 3]);
      expect(arrayGet(heap, arr, 3)).toBeUndefined();
      expect(arrayGet(heap, arr, -1)).toBeUndefined();
    });
  });

  // Tests for arrayUpdate
  describe("arrayUpdate", () => {
    it("should update an element in the array", () => {
      const arr = arrayCreate(heap, [1, 2, 3]);
      arrayUpdate(heap, arr, 1, 42);
      expect(arrayRead(heap, arr)).toEqual([1, 42, 3]);
    });

    it("should throw an error for index out of bounds", () => {
      const arr = arrayCreate(heap, [1, 2, 3]);
      expect(() => arrayUpdate(heap, arr, 3, 42)).toThrow(
        "Index out of bounds"
      );
    });
  });
});
