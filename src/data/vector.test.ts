// File: src/tests/vector.test.ts

import { Heap, BLOCK_REFS } from "./heap";
import { vectorCreate, vectorGet, vectorUpdate } from "./vector";
import { Memory } from "./memory";
import { fromTaggedValue, isNIL, Tag, TAG_ANY, NIL } from "../tagged-value";
import { NULL } from "../constants";

describe("Vector Operations", () => {
  let memory: Memory;
  let heap: Heap;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  it("vectorCreate initializes correctly", () => {
    const data = [1.1, 2.2, 3.3, 4.4, 5.5];
    const vectorPtr = vectorCreate(heap, data);
    expect(isNIL(vectorPtr)).toBeFalsy();
  });

  it("vectorGet retrieves correct values", () => {
    const data = [1.1, 2.2, 3.3, 4.4, 5.5];
    const vectorPtr = vectorCreate(heap, data);
    expect(isNIL(vectorPtr)).not.toBe(true);

    data.forEach((value, index) => {
      expect(vectorGet(heap, vectorPtr, index)).toBeCloseTo(value);
    });
  });

  it("vectorUpdate modifies values correctly", () => {
    const data = [1.1, 2.2, 3.3, 4.4, 5.5];
    const vectorPtr = vectorCreate(heap, data);
    expect(isNIL(vectorPtr)).not.toBe(true);

    const updatedValue = 9.9;
    const updatedVectorPtr = vectorUpdate(heap, vectorPtr, 2, updatedValue);
    expect(isNIL(updatedVectorPtr)).not.toBe(true);
    expect(vectorGet(heap, updatedVectorPtr, 2)).toBeCloseTo(updatedValue);
  });

  it("vectorGet returns undefined for out-of-bounds index", () => {
    const data = [1.1, 2.2, 3.3];
    const vectorPtr = vectorCreate(heap, data);
    expect(isNIL(vectorPtr)).not.toBe(true);
    // Index 10 is clearly out of bounds for a vector of length 3
    expect(vectorGet(heap, vectorPtr, 10)).toBe(NIL);
  });

  it("vectorUpdate returns UNDEF for out-of-bounds index", () => {
    const data = [1.1, 2.2, 3.3];
    const vectorPtr = vectorCreate(heap, data);
    expect(isNIL(vectorPtr)).not.toBe(true);
    // Trying to update index 10 in a vector of length 3 should fail.
    expect(vectorUpdate(heap, vectorPtr, 10, 5.5)).toBe(NIL);
  });

  it("vectorCreate handles empty array", () => {
    const vectorPtr = vectorCreate(heap, []);
    expect(isNIL(vectorPtr)).not.toBe(true);
  });

  it("vectorGet on empty vector returns undefined", () => {
    const vectorPtr = vectorCreate(heap, []);
    expect(vectorGet(heap, vectorPtr, 0)).toBe(NIL);
  });

  it("vectorUpdate on empty vector returns UNDEF", () => {
    const vectorPtr = vectorCreate(heap, []);
    expect(vectorUpdate(heap, vectorPtr, 0, 1.1)).toBe(NIL);
  });

  it("vectorCreate handles large arrays", () => {
    const largeData = new Array(1000).fill(3.14);
    const vectorPtr = vectorCreate(heap, largeData);
    expect(isNIL(vectorPtr)).not.toBe(true);
    // Check the last element to ensure the chain of blocks was correctly created.
    expect(vectorGet(heap, vectorPtr, 999)).toBeCloseTo(3.14);
  });

  it("vectorUpdate triggers copy-on-write", () => {
    const data = [1.1, 2.2, 3.3];
    const vectorPtr = vectorCreate(heap, data);
    expect(isNIL(vectorPtr)).not.toBe(true);

    // Get the underlying block pointer from the tagged vector pointer.
    const { value: block } = fromTaggedValue(Tag.BLOCK, vectorPtr);
    // Manually bump the reference count to simulate sharing (forcing copy-on-write).
    memory.write16(block + BLOCK_REFS, 2);

    const updatedVectorPtr = vectorUpdate(heap, vectorPtr, 1, 9.9);
    expect(isNIL(updatedVectorPtr)).not.toBe(true);
    // Even with copy-on-write, the updated vector should reflect the new value.
    expect(vectorGet(heap, updatedVectorPtr, 1)).toBeCloseTo(9.9);
  });

  it("vectorCreate maintains reference integrity", () => {
    const data = [1.1, 2.2, 3.3];
    const vectorPtr1 = vectorCreate(heap, data);
    const vectorPtr2 = vectorCreate(heap, data);
    expect(isNIL(vectorPtr1)).not.toBe(true);
    expect(isNIL(vectorPtr2)).not.toBe(true);
    const ptr1 = fromTaggedValue(TAG_ANY, vectorPtr1).value;
    const ptr2 = fromTaggedValue(TAG_ANY, vectorPtr2).value;
    // Ensure that two separate calls to vectorCreate yield distinct pointers.
    expect(ptr1).not.toBe(ptr2);
  });

  it("vectorGet returns UNDEF for negative index", () => {
    const data = [10, 20, 30];
    const vectorPtr = vectorCreate(heap, data);
    expect(isNIL(vectorPtr)).not.toBe(true);
    // Negative index should be out of bounds.
    expect(vectorGet(heap, vectorPtr, -1)).toBe(NIL);
  });

  it("vectorUpdate returns UNDEF for negative index", () => {
    const data = [10, 20, 30];
    const vectorPtr = vectorCreate(heap, data);
    expect(isNIL(vectorPtr)).not.toBe(true);
    // Negative index should be rejected.
    expect(vectorUpdate(heap, vectorPtr, -1, 99)).toBe(NIL);
  });

  it("vectorUpdate updates element in second block without copy-on-write", () => {
    // Create a vector with 15 elements so that the first block (capacity = 14) spills into a second block.
    const data = Array.from({ length: 15 }, (_, i) => i + 1); // [1, 2, ... 15]
    const vectorPtr = vectorCreate(heap, data);
    expect(isNIL(vectorPtr)).not.toBe(true);

    // Update an element that falls in the second block.
    // With capacityPerBlock = Math.floor((64 - 8) / 4) = 14,
    // index 14 will be the first element in the second block.
    const newValue = 99.9;
    const updatedVectorPtr = vectorUpdate(heap, vectorPtr, 14, newValue);
    expect(isNIL(updatedVectorPtr)).not.toBe(true);
    expect(vectorGet(heap, updatedVectorPtr, 14)).toBeCloseTo(newValue);
  });

  it("vectorUpdate triggers copy-on-write in second block", () => {
    // Create a vector with 15 elements so that a second block is allocated.
    const data = Array.from({ length: 15 }, (_, i) => i + 1);
    const vectorPtr = vectorCreate(heap, data);
    expect(isNIL(vectorPtr)).not.toBe(true);

    // Extract the underlying first block from the tagged vector pointer.
    const { value: firstBlock } = fromTaggedValue(Tag.BLOCK, vectorPtr);
    // Get the pointer to the second block.
    const secondBlock = heap.getNextBlock(firstBlock);
    expect(secondBlock).not.toBe(NULL);

    // Artificially bump the reference count on the second block to force copy-on-write.
    memory.write16(secondBlock + BLOCK_REFS, 2);

    // Update the element at index 14 (which resides in the second block).
    const newValue = 88.8;
    const updatedVectorPtr = vectorUpdate(heap, vectorPtr, 14, newValue);
    expect(isNIL(updatedVectorPtr)).not.toBe(true);
    expect(vectorGet(heap, updatedVectorPtr, 14)).toBeCloseTo(newValue);
  });
});
