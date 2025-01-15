import { BLOCK_SIZE, Heap } from "./heap";
import { stringCreate, stringRead, stringPrint, stringLength } from "./strings";
import { NIL, MEMORY_SIZE } from "./constants";

describe("Strings Library", () => {
  let heap: Heap;

  beforeEach(() => {
    // Create a fresh heap instance for each test
    heap = new Heap(new Array(MEMORY_SIZE).fill(0));
  });

  it("should create and read a string", () => {
    const str = stringCreate(heap, "Hello, world!");
    expect(str).not.toBe(NIL);
    expect(stringRead(heap, str)).toBe("Hello, world!");
  });

  it("should print a string", () => {
    const str = stringCreate(heap, "Hello, world!");
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    stringPrint(heap, str);
    expect(consoleSpy).toHaveBeenCalledWith("Hello, world!");
    consoleSpy.mockRestore();
  });

  it("should handle empty strings", () => {
    const str = stringCreate(heap, "");
    expect(str).not.toBe(NIL);
    expect(stringRead(heap, str)).toBe("");
  });

  it("should handle large strings", () => {
    const largeStr = "a".repeat(1000); // 1000-character string
    const str = stringCreate(heap, largeStr);
    expect(str).not.toBe(NIL);
    expect(stringRead(heap, str)).toBe(largeStr);
  });

  it("should return NIL if allocation fails", () => {
    // Fill the heap to force allocation failure
    while (heap.malloc(BLOCK_SIZE) !== NIL) {}
    const str = stringCreate(heap, "Hello, world!");
    expect(str).toBe(NIL);
  });

  // Tests for stringLength
  describe("stringLength", () => {
    it("should return the correct length for a short string", () => {
      const str = stringCreate(heap, "Hello");
      expect(stringLength(heap, str)).toBe(5);
    });

    it("should return the correct length for an empty string", () => {
      const str = stringCreate(heap, "");
      expect(stringLength(heap, str)).toBe(0);
    });

    it("should return the correct length for a long string", () => {
      const longStr = "a".repeat(1000); // 1000-character string
      const str = stringCreate(heap, longStr);
      expect(stringLength(heap, str)).toBe(1000);
    });

    it("should return 0 for an invalid string (NIL)", () => {
      expect(stringLength(heap, NIL)).toBe(0);
    });
  });
});
