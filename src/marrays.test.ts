import { NIL } from "./constants";
import { Heap } from "./heap";
import { arrayCreate, arrayGet, arrayUpdate } from "./marrays";
import { Memory } from "./memory";

describe("Array Functions", () => {
  let heap: Heap;
  let memory: Memory;

  beforeEach(() => {
    // Initialize a real Heap and Memory instance
    memory = new Memory(); // Assuming Memory has a constructor that takes a size
    heap = new Heap(memory);
  });

  it("should create and access a 1D array", () => {
    const shape = [3];
    const data = [1, 2, 3];

    const startBlock = arrayCreate(heap, shape, data);
    expect(startBlock).not.toBe(NIL);

    expect(arrayGet(memory, startBlock, [0])).toBe(1);
    expect(arrayGet(memory, startBlock, [1])).toBe(2);
    expect(arrayGet(memory, startBlock, [2])).toBe(3);
  });

  it("should create and access a 2D array", () => {
    const shape = [2, 3];
    const data = [1, 2, 3, 4, 5, 6];

    const startBlock = arrayCreate(heap, shape, data);
    expect(startBlock).not.toBe(NIL);

    expect(arrayGet(memory, startBlock, [0, 0])).toBe(1);
    expect(arrayGet(memory, startBlock, [0, 1])).toBe(2);
    expect(arrayGet(memory, startBlock, [1, 2])).toBe(6);
  });

  it("should update an element in a 2D array", () => {
    const shape = [2, 3];
    const data = [1, 2, 3, 4, 5, 6];

    const startBlock = arrayCreate(heap, shape, data);
    expect(startBlock).not.toBe(NIL);

    arrayUpdate(memory, startBlock, [1, 1], 99);
    expect(arrayGet(memory, startBlock, [1, 1])).toBe(99);
  });
});
