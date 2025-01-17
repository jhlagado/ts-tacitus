import { Memory } from "./memory";
import { BLOCK_SIZE, Heap } from "./heap";
import { NIL } from "./constants";
import {
  stringCreate,
  stringRead,
  stringLength,
  stringPrint,
  stringGet,
  stringUpdate,
} from "./strings";

describe("strings.ts", () => {
  let memory: Memory;
  let heap: Heap;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  test("should create and read a string", () => {
    const str = "hello";
    const startBlock = stringCreate(heap, str);
    expect(startBlock).not.toBe(NIL);
    expect(stringRead(memory, startBlock)).toBe(str);
  });

  test("should handle string length correctly", () => {
    const str = "world!";
    const startBlock = stringCreate(heap, str);
    expect(stringLength(memory, startBlock)).toBe(str.length);
  });

  test("should return NIL when string creation fails", () => {
    // Fill the heap to force allocation failure
    while (heap.malloc(BLOCK_SIZE) !== NIL) {}
    const str = "test";
    const startBlock = stringCreate(heap, str);
    expect(startBlock).toBe(NIL);
  });

  test("should print a string", () => {
    const str = "print test";
    const startBlock = stringCreate(heap, str);
    const consoleSpy = jest.spyOn(console, "log");
    stringPrint(memory, startBlock);
    expect(consoleSpy).toHaveBeenCalledWith(str);
    consoleSpy.mockRestore();
  });

  test("should get a character from a string", () => {
    const str = "character test";
    const startBlock = stringCreate(heap, str);
    expect(stringGet(memory, startBlock, 0)).toBe("c");
    expect(stringGet(memory, startBlock, 6)).toBe("t");
    expect(stringGet(memory, startBlock, str.length - 1)).toBe("t");
    expect(stringGet(memory, startBlock, str.length)).toBeUndefined();
  });

  test("should update a character in a string", () => {
    const str = "update";
    const startBlock = stringCreate(heap, str);
    stringUpdate(memory, startBlock, 0, "U");
    stringUpdate(memory, startBlock, 5, "D");
    expect(stringRead(memory, startBlock)).toBe("UpdatD");
  });

  test("should handle strings spanning multiple blocks", () => {
    const str = "a".repeat(BLOCK_SIZE * 3); // Create a long string spanning 3 blocks
    const startBlock = stringCreate(heap, str);
    expect(stringRead(memory, startBlock)).toBe(str);
    expect(stringLength(memory, startBlock)).toBe(str.length);
  });

  test("should handle update on strings spanning multiple blocks", () => {
    const str = "a".repeat(BLOCK_SIZE * 3); // Create a long string spanning 3 blocks
    const startBlock = stringCreate(heap, str);

    // Update a character in the second block
    const updateIndex = BLOCK_SIZE + 5;
    stringUpdate(memory, startBlock, updateIndex, "b");
    const result = stringRead(memory, startBlock);
    expect(result[updateIndex]).toBe("b");
    expect(result).toHaveLength(str.length);
  });

  test("should gracefully handle update out of bounds", () => {
    const str = "short";
    const startBlock = stringCreate(heap, str);

    expect(() => {
      stringUpdate(memory, startBlock, 10, "x");
    }).toThrow("Index out of bounds");
  });
});
