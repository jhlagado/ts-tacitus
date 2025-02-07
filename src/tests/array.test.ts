import { Heap } from "../heap";
import { Memory } from "../memory";
import {
  arrayCreate,
  arrayGet,
  arrayUpdate,
  MAX_DIMENSIONS,
} from "../array";
import { NULL } from "../constants";

describe("arrays.ts", () => {
  let heap: Heap;
  let memory: Memory;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  describe("arrayCreate", () => {
    it("should create a 1D array with valid shape and data", () => {
      const shape = [3];
      const data = [1, 2, 3];
      const arrayPtr = arrayCreate(heap, shape, data);

      expect(arrayPtr).not.toBe(NULL);
      expect(arrayGet(heap, arrayPtr, [0])).toBe(1);
      expect(arrayGet(heap, arrayPtr, [1])).toBe(2);
      expect(arrayGet(heap, arrayPtr, [2])).toBe(3);
    });

    it("should create a 2D array with valid shape and data", () => {
      const shape = [2, 2];
      const data = [1, 2, 3, 4];
      const arrayPtr = arrayCreate(heap, shape, data);

      expect(arrayPtr).not.toBe(NULL);
      expect(arrayGet(heap, arrayPtr, [0, 0])).toBe(1);
      expect(arrayGet(heap, arrayPtr, [0, 1])).toBe(2);
      expect(arrayGet(heap, arrayPtr, [1, 0])).toBe(3);
      expect(arrayGet(heap, arrayPtr, [1, 1])).toBe(4);
    });

    it("should return NULL if the number of dimensions exceeds MAX_DIMENSIONS", () => {
      const shape = Array(MAX_DIMENSIONS + 1).fill(2); // Exceeds max dimensions
      const data = Array(2 ** (MAX_DIMENSIONS + 1)).fill(0);
      const arrayPtr = arrayCreate(heap, shape, data);

      expect(arrayPtr).toBe(NULL);
    });

    it("should return NULL if the vector creation fails", () => {
      jest.spyOn(heap, "malloc").mockReturnValueOnce(0); // Simulate malloc failure

      const shape = [2];
      const data = [1, 2];
      const arrayPtr = arrayCreate(heap, shape, data);

      expect(arrayPtr).toBe(NULL);
    });
  });

  describe("arrayGet", () => {
    it("should retrieve the correct element from a 1D array", () => {
      const shape = [3];
      const data = [10, 20, 30];
      const arrayPtr = arrayCreate(heap, shape, data);

      expect(arrayGet(heap, arrayPtr, [0])).toBe(10);
      expect(arrayGet(heap, arrayPtr, [1])).toBe(20);
      expect(arrayGet(heap, arrayPtr, [2])).toBe(30);
    });

    it("should retrieve the correct element from a 2D array", () => {
      const shape = [2, 2];
      const data = [10, 20, 30, 40];
      const arrayPtr = arrayCreate(heap, shape, data);

      expect(arrayGet(heap, arrayPtr, [0, 0])).toBe(10);
      expect(arrayGet(heap, arrayPtr, [0, 1])).toBe(20);
      expect(arrayGet(heap, arrayPtr, [1, 0])).toBe(30);
      expect(arrayGet(heap, arrayPtr, [1, 1])).toBe(40);
    });

    it("should return undefined for out-of-bounds indices", () => {
      const shape = [2];
      const data = [10, 20];
      const arrayPtr = arrayCreate(heap, shape, data);

      expect(arrayGet(heap, arrayPtr, [-1])).toBeUndefined();
      expect(arrayGet(heap, arrayPtr, [2])).toBeUndefined();
    });

    it("should return undefined if the pointer is not a tagged value", () => {
      const invalidPtr = 12345; // Not a tagged value
      expect(arrayGet(heap, invalidPtr, [0])).toBeUndefined();
    });
  });

  describe("arrayUpdate", () => {
    it("should update an element in a 1D array", () => {
      const shape = [3];
      const data = [10, 20, 30];
      const arrayPtr = arrayCreate(heap, shape, data);

      const updatedPtr = arrayUpdate(heap, arrayPtr, [1], 99);
      expect(updatedPtr).not.toBe(NULL);
      expect(arrayGet(heap, updatedPtr, [0])).toBe(10);
      expect(arrayGet(heap, updatedPtr, [1])).toBe(99);
      expect(arrayGet(heap, updatedPtr, [2])).toBe(30);
    });

    it("should update an element in a 2D array", () => {
      const shape = [2, 2];
      const data = [10, 20, 30, 40];
      const arrayPtr = arrayCreate(heap, shape, data);

      const updatedPtr = arrayUpdate(heap, arrayPtr, [1, 1], 99);
      expect(updatedPtr).not.toBe(NULL);
      expect(arrayGet(heap, updatedPtr, [0, 0])).toBe(10);
      expect(arrayGet(heap, updatedPtr, [0, 1])).toBe(20);
      expect(arrayGet(heap, updatedPtr, [1, 0])).toBe(30);
      expect(arrayGet(heap, updatedPtr, [1, 1])).toBe(99);
    });

    it("should return NULL for out-of-bounds indices", () => {
      const shape = [2];
      const data = [10, 20];
      const arrayPtr = arrayCreate(heap, shape, data);

      const updatedPtr = arrayUpdate(heap, arrayPtr, [2], 99);
      expect(updatedPtr).toBe(NULL);
    });

    it("should return NULL if the pointer is not a tagged value", () => {
      const invalidPtr = 12345; // Not a tagged value
      const updatedPtr = arrayUpdate(heap, invalidPtr, [0], 99);
      expect(updatedPtr).toBe(NULL);
    });
  });
});