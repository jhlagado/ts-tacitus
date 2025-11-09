import { Memory, MEMORY_SIZE, SEG_DATA, STACK_SIZE, CELL_SIZE, STACK_BASE_BYTES, STACK_BASE_CELLS } from '../../core';

describe('Memory', () => {
  let memory: Memory;
  beforeEach(() => {
    memory = new Memory();
  });
  const stackBaseAddr = () => memory.resolveAddress(SEG_DATA, STACK_BASE_BYTES);

  test('should write and read 8-bit values correctly', () => {
    memory.write8(SEG_DATA, STACK_BASE_BYTES + 0, 255);
    expect(memory.read8(SEG_DATA, STACK_BASE_BYTES + 0)).toBe(255);
    memory.write8(SEG_DATA, STACK_BASE_BYTES + 1, 128);
    expect(memory.read8(SEG_DATA, STACK_BASE_BYTES + 1)).toBe(128);
  });
  test('should write and read Float32 values correctly', () => {
    const value = 3.14159;
    memory.writeFloat32(SEG_DATA, STACK_BASE_BYTES + 30, value);
    expect(memory.readFloat32(SEG_DATA, STACK_BASE_BYTES + 30)).toBeCloseTo(value, 5);
  });
  test('should throw error for out-of-bounds access', () => {
    // Outside DATA segment bounds
    expect(() => memory.write8(SEG_DATA, MEMORY_SIZE, 1)).toThrow(RangeError);
    expect(() => memory.read8(SEG_DATA, MEMORY_SIZE)).toThrow(RangeError);
    expect(() => memory.writeFloat32(SEG_DATA, MEMORY_SIZE - 3, 1.23)).toThrow(RangeError);
    expect(() => memory.readFloat32(SEG_DATA, MEMORY_SIZE - 3)).toThrow(RangeError);
  });
  test('should dump memory for debugging', () => {
    memory.write8(SEG_DATA, STACK_BASE_BYTES + 0, 0xaa);
    memory.write8(SEG_DATA, STACK_BASE_BYTES + 1, 0xbb);
    memory.write8(SEG_DATA, STACK_BASE_BYTES + 2, 0xcc);
    const base = stackBaseAddr();
    const dump = memory.dump(base, base + 2);
    expect(dump).toBe('aa bb cc');
  });
  test('should write and read 16-bit values correctly', () => {
    memory.write16(SEG_DATA, STACK_BASE_BYTES + 0, 0x1234);
    expect(memory.read16(SEG_DATA, STACK_BASE_BYTES + 0)).toBe(0x1234);
    memory.write16(SEG_DATA, STACK_BASE_BYTES + 10, 0xffff);
    expect(memory.read16(SEG_DATA, STACK_BASE_BYTES + 10)).toBe(0xffff);
    const lastValidOffset = STACK_SIZE - 2;
    memory.write16(SEG_DATA, STACK_BASE_BYTES + lastValidOffset, 0xabcd);
    expect(memory.read16(SEG_DATA, STACK_BASE_BYTES + lastValidOffset)).toBe(0xabcd);
  });
  test('should throw RangeError for 16-bit boundary violations', () => {
    const overflowOffset = MEMORY_SIZE - STACK_BASE_BYTES - 1;
    expect(() => memory.write16(SEG_DATA, STACK_BASE_BYTES + overflowOffset, 0x1234)).toThrow(RangeError);
    expect(() => memory.read16(SEG_DATA, STACK_BASE_BYTES + overflowOffset)).toThrow(RangeError);
  });
  test('should handle invalid dump ranges', () => {
    expect(() => memory.dump(10, 5)).toThrow(RangeError);
    expect(() => memory.dump(-1, 5)).toThrow(RangeError);
    expect(() => memory.dump(0, MEMORY_SIZE)).toThrow(RangeError);
  });
  test('should handle full float boundary conditions', () => {
    const lastFloatOffset = STACK_SIZE - CELL_SIZE;
    memory.writeFloat32(SEG_DATA, STACK_BASE_BYTES + lastFloatOffset, 1.234);
    expect(memory.readFloat32(SEG_DATA, STACK_BASE_BYTES + lastFloatOffset)).toBeCloseTo(1.234);
    const overflowOffset = MEMORY_SIZE - STACK_BASE_BYTES - (CELL_SIZE - 1);
    expect(() => memory.writeFloat32(SEG_DATA, STACK_BASE_BYTES + overflowOffset, 5.678)).toThrow(
      RangeError,
    );
  });

  test('should handle dumping memory as characters', () => {
    memory.write8(SEG_DATA, STACK_BASE_BYTES + 0, 0x41);
    memory.write8(SEG_DATA, STACK_BASE_BYTES + 1, 0x42);
    memory.write8(SEG_DATA, STACK_BASE_BYTES + 2, 0x43);
    const base = stackBaseAddr();
    const dumpChars = memory.dumpChars(base, base + 2);
    expect(dumpChars).toBe('A B C');
  });
  test('should handle invalid dumpChars ranges', () => {
    expect(() => memory.dumpChars(10, 5)).toThrow(RangeError);
    expect(() => memory.dumpChars(-1, 5)).toThrow(RangeError);
    expect(() => memory.dumpChars(0, MEMORY_SIZE)).toThrow(RangeError);
  });
});
