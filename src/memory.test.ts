import { Memory } from "./memory";

describe("Memory", () => {
  let memory: Memory;

  beforeEach(() => {
    memory = new Memory(64); // 64 bytes of memory
  });

  test("should read/write 8-bit values correctly", () => {
    memory.write8(0, 0x10);
    memory.write8(1, 0xff);

    expect(memory.read8(0)).toBe(0x10);
    expect(memory.read8(1)).toBe(0xff);
    expect(memory.read8(1, true)).toBe(-1); // Signed interpretation
  });

  test("should read/write 16-bit values correctly", () => {
    memory.write16(2, 0x1234);
    memory.write16(4, 0xffff);

    expect(memory.read16(2)).toBe(0x1234);
    expect(memory.read16(4)).toBe(0xffff);
    expect(memory.read16(4, true)).toBe(-1); // Signed interpretation
  });

  test("should read/write 32-bit values correctly", () => {
    memory.write32(8, 0xdeadbeef);
    memory.write32(12, -12345678 >>> 0);

    expect(memory.read32(8)).toBe(0xdeadbeef);
    expect(memory.read32(12, true)).toBe(-12345678); // Signed interpretation
  });

  test("should read/write Float32 values correctly", () => {
    memory.writeFloat32(16, 3.14);
    memory.writeFloat32(20, -123.456);

    expect(memory.readFloat32(16)).toBeCloseTo(3.14);
    expect(memory.readFloat32(20)).toBeCloseTo(-123.456);
  });

  test("should throw error for misaligned accesses", () => {
    expect(() => memory.read16(1)).toThrowError();
    expect(() => memory.read32(2)).toThrowError();
  });

  test("should throw error for out-of-bounds access", () => {
    expect(() => memory.read8(64)).toThrowError();
    expect(() => memory.write8(64, 0xff)).toThrowError();
  });
});
