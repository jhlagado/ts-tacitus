import { Memory } from "./memory";

describe("Memory", () => {
  const MEMORY_SIZE = 1024;
  let memory: Memory;

  beforeEach(() => {
    memory = new Memory(MEMORY_SIZE);
  });

  test("should write and read 8-bit values correctly", () => {
    memory.write8(0, 255);
    expect(memory.read8(0)).toBe(255);

    memory.write8(1, 128);
    expect(memory.read8(1)).toBe(128);
  });

  test("should write and read Float32 values correctly", () => {
    const value = 3.14159;
    memory.writeFloat(30, value);
    expect(memory.readFloat(30)).toBeCloseTo(value, 5);
  });

  test("should throw error for out-of-bounds access", () => {
    expect(() => memory.write8(MEMORY_SIZE, 1)).toThrow(RangeError);
    expect(() => memory.read8(MEMORY_SIZE)).toThrow(RangeError);

    expect(() => memory.writeFloat(MEMORY_SIZE - 3, 1.23)).toThrow(
      RangeError
    );
    expect(() => memory.readFloat(MEMORY_SIZE - 3)).toThrow(RangeError);
  });

  test("should dump memory for debugging", () => {
    memory.write8(0, 0xaa);
    memory.write8(1, 0xbb);
    memory.write8(2, 0xcc);

    const dump = memory.dump(0, 2);
    expect(dump).toBe("aa bb cc");
  });
});
