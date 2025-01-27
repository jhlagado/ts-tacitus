import { Heap } from "./heap";
import { arrayCreate, arrayGet, arrayUpdate } from "./marrays";
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
});
