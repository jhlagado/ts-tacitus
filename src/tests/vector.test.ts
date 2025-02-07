import { Heap } from "../heap";
import { vectorCreate, vectorGet, vectorUpdate } from "../vector";
import { NULL } from "../constants";
import { Memory } from "../memory";

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
    expect(vectorPtr).not.toBe(NULL);
  });

  it("vectorGet retrieves correct values", () => {
    const data = [1.1, 2.2, 3.3, 4.4, 5.5];
    const vectorPtr = vectorCreate(heap, data);
    expect(vectorPtr).not.toBe(NULL);

    data.forEach((value, index) => {
      expect(vectorGet(heap, vectorPtr, index)).toBeCloseTo(value);
    });
  });

  it("vectorUpdate modifies values correctly", () => {
    const data = [1.1, 2.2, 3.3, 4.4, 5.5];
    const vectorPtr = vectorCreate(heap, data);
    expect(vectorPtr).not.toBe(NULL);

    const updatedValue = 9.9;
    const updatedVectorPtr = vectorUpdate(heap, vectorPtr, 2, updatedValue);
    expect(updatedVectorPtr).not.toBe(NULL);
    expect(vectorGet(heap, updatedVectorPtr, 2)).toBeCloseTo(updatedValue);
  });

  xit("vectorGet returns undefined for out-of-bounds index", () => {
    const data = [1.1, 2.2, 3.3];
    const vectorPtr = vectorCreate(heap, data);
    expect(vectorPtr).not.toBe(NULL);
    expect(vectorGet(heap, vectorPtr, 10)).toBeUndefined();
  });

  xit("vectorUpdate returns NULL for out-of-bounds index", () => {
    const data = [1.1, 2.2, 3.3];
    const vectorPtr = vectorCreate(heap, data);
    expect(vectorPtr).not.toBe(NULL);
    expect(vectorUpdate(heap, vectorPtr, 10, 5.5)).toBe(NULL);
  });

  it("vectorCreate handles empty array", () => {
    const vectorPtr = vectorCreate(heap, []);
    expect(vectorPtr).not.toBe(NULL);
  });

  xit("vectorGet on empty vector returns undefined", () => {
    const vectorPtr = vectorCreate(heap, []);
    expect(vectorGet(heap, vectorPtr, 0)).toBeUndefined();
  });

  xit("vectorUpdate on empty vector returns NULL", () => {
    const vectorPtr = vectorCreate(heap, []);
    expect(vectorUpdate(heap, vectorPtr, 0, 1.1)).toBe(NULL);
  });

  xit("vectorCreate handles large arrays", () => {
    const largeData = new Array(1000).fill(3.14);
    const vectorPtr = vectorCreate(heap, largeData);
    expect(vectorPtr).not.toBe(NULL);
    expect(vectorGet(heap, vectorPtr, 999)).toBeCloseTo(3.14);
  });

  xit("vectorUpdate does not modify original vector due to copy-on-write", () => {
    const data = [1.1, 2.2, 3.3];
    const vectorPtr = vectorCreate(heap, data);
    const updatedVectorPtr = vectorUpdate(heap, vectorPtr, 1, 9.9);
    expect(updatedVectorPtr).not.toBe(NULL);
    expect(vectorGet(heap, vectorPtr, 1)).toBeCloseTo(2.2);
  });

  xit("vectorCreate maintains reference integrity", () => {
    const data = [1.1, 2.2, 3.3];
    const vectorPtr1 = vectorCreate(heap, data);
    const vectorPtr2 = vectorCreate(heap, data);
    expect(vectorPtr1).not.toBe(vectorPtr2);
  });
});
