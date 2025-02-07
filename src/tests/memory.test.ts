import { Memory, MEMORY_SIZE } from "../memory";

describe("Memory", () => {
  let memory: Memory;

  beforeEach(() => {
    memory = new Memory();
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

    expect(() => memory.writeFloat(MEMORY_SIZE - 3, 1.23)).toThrow(RangeError);
    expect(() => memory.readFloat(MEMORY_SIZE - 3)).toThrow(RangeError);
  });

  test("should dump memory for debugging", () => {
    memory.write8(0, 0xaa);
    memory.write8(1, 0xbb);
    memory.write8(2, 0xcc);

    const dump = memory.dump(0, 2);
    expect(dump).toBe("aa bb cc");
  });

  test("should write and read 16-bit values correctly", () => {
    // Normal operation
    memory.write16(0, 0x1234);
    expect(memory.read16(0)).toBe(0x1234);

    // Maximum value
    memory.write16(10, 0xffff);
    expect(memory.read16(10)).toBe(0xffff);

    // Edge of memory boundary
    const lastValidAddress = MEMORY_SIZE - 2;
    memory.write16(lastValidAddress, 0xabcd);
    expect(memory.read16(lastValidAddress)).toBe(0xabcd);
  });

  test("should throw RangeError for 16-bit boundary violations", () => {
    // Writing 1 byte past end
    expect(() => memory.write16(MEMORY_SIZE - 1, 0x1234)).toThrow(RangeError);

    // Reading 1 byte past end
    expect(() => memory.read16(MEMORY_SIZE - 1)).toThrow(RangeError);
  });

  test("should handle tagged address pointers", () => {
    const testAddress = 0x1234;

    // Write/read valid address
    memory.writeAddress(20, testAddress);
    expect(memory.readAddress(20)).toBe(testAddress);

    // Test invalid tag handling
    memory.writeFloat(24, 123.45); // Write non-tagged float
    expect(() => memory.readAddress(24)).toThrow(
      "Value is not a Tagged Pointer"
    );
  });

  test("should handle tagged integer values", () => {
    const testValue = -12345;

    // Write/read valid integer
    memory.writeInteger(40, testValue);
    expect(memory.readInteger(40)).toBe(testValue);

    // Test invalid tag handling
    memory.writeFloat(44, 3.14159); // Write non-tagged float
    expect(() => memory.readInteger(44)).toThrow(
      "Value is not a Tagged Pointer"
    );
  });

  test("should handle invalid dump ranges", () => {
    // Start > end
    expect(() => memory.dump(10, 5)).toThrow(RangeError);

    // Negative start
    expect(() => memory.dump(-1, 5)).toThrow(RangeError);

    // End beyond memory
    expect(() => memory.dump(0, MEMORY_SIZE)).toThrow(RangeError);
  });

  test("should handle full float boundary conditions", () => {
    // Valid float at end of memory
    const lastFloatAddress = MEMORY_SIZE - 4;
    memory.writeFloat(lastFloatAddress, 1.234);
    expect(memory.readFloat(lastFloatAddress)).toBeCloseTo(1.234);

    // Invalid float at memory end
    expect(() => memory.writeFloat(MEMORY_SIZE - 3, 5.678)).toThrow(RangeError);
  });

  // Additional tests to cover specific lines

  test("should handle dumping memory as characters", () => {
    memory.write8(0, 0x41); // 'A'
    memory.write8(1, 0x42); // 'B'
    memory.write8(2, 0x43); // 'C'

    const dumpChars = memory.dumpChars(0, 2);
    expect(dumpChars).toBe("A B C");
  });

  test("should handle invalid dumpChars ranges", () => {
    // Start > end
    expect(() => memory.dumpChars(10, 5)).toThrow(RangeError);

    // Negative start
    expect(() => memory.dumpChars(-1, 5)).toThrow(RangeError);

    // End beyond memory
    expect(() => memory.dumpChars(0, MEMORY_SIZE)).toThrow(RangeError);
  });
});
