// File: src/tests/view.test.ts

import { Heap } from "./heap";
import { Memory } from "../memory";
import { MAX_DIMENSIONS_VIEW, viewCreate, viewGet, viewUpdate } from "./view";
import { vectorCreate } from "./vector";
import { UNDEF } from "../tagged-value";

describe("View System", () => {
  let memory: Memory;
  let heap: Heap;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  it("should create a view on a vector", () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8];
    const vectorPtr = vectorCreate(heap, data);
    expect(vectorPtr).not.toBe(UNDEF);

    // Create a view that covers the entire vector.
    // The view is one-dimensional, with shape [8] and an offset of 0.
    const viewPtr = viewCreate(heap, vectorPtr, 0, [8]);
    expect(viewPtr).not.toBe(UNDEF);

    // Verify that each element matches the original data.
    for (let i = 0; i < 8; i++) {
      expect(viewGet(heap, viewPtr, [i])).toBeCloseTo(data[i]);
    }
  });

  it("should update an element in a view", () => {
    const data = [10, 20, 30, 40];
    const vectorPtr = vectorCreate(heap, data);
    expect(vectorPtr).not.toBe(UNDEF);

    // Create a view over the entire vector.
    const viewPtr = viewCreate(heap, vectorPtr, 0, [4]);
    expect(viewPtr).not.toBe(UNDEF);

    // Update the element at index 2 to 99.
    const updatedView = viewUpdate(heap, viewPtr, [2], 99);
    expect(updatedView).not.toBe(UNDEF);
    expect(viewGet(heap, updatedView, [2])).toBeCloseTo(99);

    // Verify other elements remain unchanged.
    expect(viewGet(heap, updatedView, [0])).toBeCloseTo(10);
    expect(viewGet(heap, updatedView, [1])).toBeCloseTo(20);
    expect(viewGet(heap, updatedView, [3])).toBeCloseTo(40);
  });

  it("should create a view of a view", () => {
    const data = [5, 6, 7, 8, 9, 10];
    const vectorPtr = vectorCreate(heap, data);
    expect(vectorPtr).not.toBe(UNDEF);

    // Create a base view covering the entire vector (1D view of length 6).
    const baseView = viewCreate(heap, vectorPtr, 0, [6]);
    expect(baseView).not.toBe(UNDEF);

    // Create a subview from the base view:
    // For example, start at an additional offset of 2 and take 3 elements.
    const subView = viewCreate(heap, baseView, 2, [3]);
    expect(subView).not.toBe(UNDEF);

    // Given data = [5, 6, 7, 8, 9, 10]:
    // A base view from offset 0 gives: [5,6,7,8,9,10]
    // A subview with offset 2 and shape [3] should yield elements at indices 2,3,4: [7,8,9]
    expect(viewGet(heap, subView, [0])).toBeCloseTo(7);
    expect(viewGet(heap, subView, [1])).toBeCloseTo(8);
    expect(viewGet(heap, subView, [2])).toBeCloseTo(9);
  });

  it("should return UNDEF for out-of-bounds indices", () => {
    const data = [100, 200, 300];
    const vectorPtr = vectorCreate(heap, data);
    expect(vectorPtr).not.toBe(UNDEF);

    // Create a view with shape [3].
    const viewPtr = viewCreate(heap, vectorPtr, 0, [3]);
    expect(viewPtr).not.toBe(UNDEF);

    // Negative index should be out-of-bounds.
    expect(viewGet(heap, viewPtr, [-1])).toBe(UNDEF);
    // Index equal to the shape length is out-of-bounds.
    expect(viewGet(heap, viewPtr, [3])).toBe(UNDEF);

    // viewUpdate should similarly return UNDEF for out-of-bound indices.
    expect(viewUpdate(heap, viewPtr, [3], 999)).toBe(UNDEF);
    expect(viewUpdate(heap, viewPtr, [-1], 999)).toBe(UNDEF);
  });

  it("should work with multi-dimensional view", () => {
    // Create data representing a 2D array: 2 rows, 3 columns.
    // Data in row-major order: [1, 2, 3, 4, 5, 6]
    const data = [1, 2, 3, 4, 5, 6];
    const vectorPtr = vectorCreate(heap, data);
    expect(vectorPtr).not.toBe(UNDEF);

    // Create a 2D view with shape [2, 3].
    // In row-major order, strides should be: for last dimension: 1,
    // for the first dimension: number of columns (3).
    const viewPtr = viewCreate(heap, vectorPtr, 0, [2, 3]);
    expect(viewPtr).not.toBe(UNDEF);

    // Verify first row.
    expect(viewGet(heap, viewPtr, [0, 0])).toBeCloseTo(1);
    expect(viewGet(heap, viewPtr, [0, 1])).toBeCloseTo(2);
    expect(viewGet(heap, viewPtr, [0, 2])).toBeCloseTo(3);
    // Verify second row.
    expect(viewGet(heap, viewPtr, [1, 0])).toBeCloseTo(4);
    expect(viewGet(heap, viewPtr, [1, 1])).toBeCloseTo(5);
    expect(viewGet(heap, viewPtr, [1, 2])).toBeCloseTo(6);

    // Test viewUpdate in 2D.
    const updatedView = viewUpdate(heap, viewPtr, [1, 1], 99);
    expect(updatedView).not.toBe(UNDEF);
    expect(viewGet(heap, updatedView, [1, 1])).toBeCloseTo(99);
  });

  describe("View Edge Cases", () => {
    let memory: Memory;
    let heap: Heap;

    beforeEach(() => {
      memory = new Memory();
      heap = new Heap(memory);
    });

    it("viewCreate returns UNDEF when shape dimensions exceed MAX_DIMENSIONS_VIEW", () => {
      // Create a shape array with more dimensions than allowed.
      const shape = new Array(MAX_DIMENSIONS_VIEW + 1).fill(2);
      // Create a valid vector base.
      const vectorPtr = vectorCreate(heap, [1, 2, 3, 4, 5, 6]);
      expect(vectorPtr).not.toBe(UNDEF);

      const viewPtr = viewCreate(heap, vectorPtr, 0, shape);
      expect(viewPtr).toBe(UNDEF);
    });

    it("viewCreate returns UNDEF for invalid base pointer", () => {
      // Pass a non-tagged pointer (not a VECTOR or VIEW).
      const invalidBase = 12345; // Not a valid tagged pointer.
      const viewPtr = viewCreate(heap, invalidBase, 0, [3]);
      expect(viewPtr).toBe(UNDEF);
    });

    it("viewGet returns UNDEF for a non-tagged view pointer", () => {
      // Pass a pointer that isn't tagged as a view.
      const result = viewGet(heap, 54321, [0]);
      expect(result).toBe(UNDEF);
    });

    it("viewGet returns UNDEF when indices length mismatches view dimensions", () => {
      const data = [10, 20, 30, 40];
      const vectorPtr = vectorCreate(heap, data);
      expect(vectorPtr).not.toBe(UNDEF);

      // Create a one-dimensional view with 4 elements.
      const viewPtr = viewCreate(heap, vectorPtr, 0, [4]);
      expect(viewPtr).not.toBe(UNDEF);

      // Provide an indices array with the wrong number of elements.
      expect(viewGet(heap, viewPtr, [0, 0])).toBe(UNDEF);
    });

    it("viewGet returns UNDEF for out-of-bound indices", () => {
      const data = [100, 200, 300];
      const vectorPtr = vectorCreate(heap, data);
      expect(vectorPtr).not.toBe(UNDEF);

      const viewPtr = viewCreate(heap, vectorPtr, 0, [3]);
      expect(viewPtr).not.toBe(UNDEF);

      // Negative index.
      expect(viewGet(heap, viewPtr, [-1])).toBe(UNDEF);
      // Index equal to the view's length.
      expect(viewGet(heap, viewPtr, [3])).toBe(UNDEF);
    });

    it("viewUpdate returns UNDEF for a non-tagged view pointer", () => {
      // Pass an invalid (non-tagged) pointer to viewUpdate.
      const result = viewUpdate(heap, 99999, [0], 123);
      expect(result).toBe(UNDEF);
    });

    it("viewUpdate returns UNDEF when indices length mismatches view dimensions", () => {
      const data = [10, 20, 30, 40];
      const vectorPtr = vectorCreate(heap, data);
      expect(vectorPtr).not.toBe(UNDEF);

      const viewPtr = viewCreate(heap, vectorPtr, 0, [4]);
      expect(viewPtr).not.toBe(UNDEF);

      // Provide an indices array with an incorrect number of indices.
      expect(viewUpdate(heap, viewPtr, [1, 2], 50)).toBe(UNDEF);
    });

    it("viewUpdate returns UNDEF for out-of-bound indices", () => {
      const data = [5, 15, 25];
      const vectorPtr = vectorCreate(heap, data);
      expect(vectorPtr).not.toBe(UNDEF);

      const viewPtr = viewCreate(heap, vectorPtr, 0, [3]);
      expect(viewPtr).not.toBe(UNDEF);

      // Index 3 (when valid indices are 0,1,2) is out-of-bound.
      expect(viewUpdate(heap, viewPtr, [3], 999)).toBe(UNDEF);
      expect(viewUpdate(heap, viewPtr, [-1], 999)).toBe(UNDEF);
    });

    it("chain of views accumulates offset correctly", () => {
      // Create a vector with data [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const vectorPtr = vectorCreate(heap, data);
      expect(vectorPtr).not.toBe(UNDEF);

      // Create a base view: offset 2, shape [6]. This should cover elements 3..8.
      const view1 = viewCreate(heap, vectorPtr, 2, [6]);
      expect(view1).not.toBe(UNDEF);
      expect(viewGet(heap, view1, [0])).toBeCloseTo(3);

      // Create a subview from view1: additional offset 1, shape [4]. This should cover elements 4..7.
      const view2 = viewCreate(heap, view1, 1, [4]);
      expect(view2).not.toBe(UNDEF);
      expect(viewGet(heap, view2, [0])).toBeCloseTo(4);
      expect(viewGet(heap, view2, [3])).toBeCloseTo(7);
    });
  });

  it("viewCreate returns UNDEF when shape is empty", () => {
    const vectorPtr = vectorCreate(heap, [1, 2, 3]);
    expect(vectorPtr).not.toBe(UNDEF);

    const viewPtr = viewCreate(heap, vectorPtr, 0, []);
    expect(viewPtr).toBe(UNDEF);
  });

  it("viewCreate returns UNDEF when offset exceeds vector length", () => {
    const vectorPtr = vectorCreate(heap, [1, 2, 3]);
    expect(vectorPtr).not.toBe(UNDEF);

    const viewPtr = viewCreate(heap, vectorPtr, 5, [1]);
    expect(viewPtr).toBe(UNDEF);
  });

  it("viewCreate computes strides correctly for multidimensional views", () => {
    const vectorPtr = vectorCreate(heap, [1, 2, 3, 4, 5, 6]);
    expect(vectorPtr).not.toBe(UNDEF);

    const viewPtr = viewCreate(heap, vectorPtr, 0, [2, 3]);
    expect(viewPtr).not.toBe(UNDEF);

    expect(viewGet(heap, viewPtr, [0, 0])).toBe(1);
    expect(viewGet(heap, viewPtr, [0, 2])).toBe(3);
    expect(viewGet(heap, viewPtr, [1, 0])).toBe(4);
    expect(viewGet(heap, viewPtr, [1, 2])).toBe(6);
  });
});
