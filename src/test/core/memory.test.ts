import {
  type Memory,
  createMemory,
  memoryResolveAddress,
  memoryWrite8,
  memoryRead8,
  memoryWrite16,
  memoryRead16,
  memoryWriteCell,
  memoryReadCell,
  memoryDump,
  memoryDumpChars,
  MEMORY_SIZE_BYTES,
  SEG_DATA,
  STACK_SIZE_BYTES,
  CELL_SIZE,
  STACK_BASE_BYTES,
  STACK_BASE,
} from '../../core';

describe('Memory', () => {
  let memory: Memory;
  beforeEach(() => {
    memory = createMemory();
  });
  const stackBaseAddr = () => memoryResolveAddress(memory, SEG_DATA, STACK_BASE_BYTES);

  test('should write and read 8-bit values correctly', () => {
    memoryWrite8(memory, SEG_DATA, STACK_BASE_BYTES + 0, 255);
    expect(memoryRead8(memory, SEG_DATA, STACK_BASE_BYTES + 0)).toBe(255);
    memoryWrite8(memory, SEG_DATA, STACK_BASE_BYTES + 1, 128);
    expect(memoryRead8(memory, SEG_DATA, STACK_BASE_BYTES + 1)).toBe(128);
  });
  test('should write and read Float32 values correctly', () => {
    const value = 3.14159;
    const cellIndex = STACK_BASE + Math.floor(30 / CELL_SIZE);
    memoryWriteCell(memory, cellIndex, value);
    expect(memoryReadCell(memory, cellIndex)).toBeCloseTo(value, 5);
  });
  test('should throw error for out-of-bounds access', () => {
    // Outside DATA segment bounds
    expect(() => memoryWrite8(memory, SEG_DATA, MEMORY_SIZE_BYTES, 1)).toThrow(RangeError);
    expect(() => memoryRead8(memory, SEG_DATA, MEMORY_SIZE_BYTES)).toThrow(RangeError);
    const outOfBoundsCell = Math.floor(MEMORY_SIZE_BYTES / CELL_SIZE);
    expect(() => memoryWriteCell(memory, outOfBoundsCell, 1.23)).toThrow(RangeError);
    expect(() => memoryReadCell(memory, outOfBoundsCell)).toThrow(RangeError);
  });
  test('should dump memory for debugging', () => {
    memoryWrite8(memory, SEG_DATA, STACK_BASE_BYTES + 0, 0xaa);
    memoryWrite8(memory, SEG_DATA, STACK_BASE_BYTES + 1, 0xbb);
    memoryWrite8(memory, SEG_DATA, STACK_BASE_BYTES + 2, 0xcc);
    const base = stackBaseAddr();
    const dump = memoryDump(memory, base, base + 2);
    expect(dump).toBe('aa bb cc');
  });
  test('should write and read 16-bit values correctly', () => {
    memoryWrite16(memory, SEG_DATA, STACK_BASE_BYTES + 0, 0x1234);
    expect(memoryRead16(memory, SEG_DATA, STACK_BASE_BYTES + 0)).toBe(0x1234);
    memoryWrite16(memory, SEG_DATA, STACK_BASE_BYTES + 10, 0xffff);
    expect(memoryRead16(memory, SEG_DATA, STACK_BASE_BYTES + 10)).toBe(0xffff);
    const lastValidOffset = STACK_SIZE_BYTES - 2;
    memoryWrite16(memory, SEG_DATA, STACK_BASE_BYTES + lastValidOffset, 0xabcd);
    expect(memoryRead16(memory, SEG_DATA, STACK_BASE_BYTES + lastValidOffset)).toBe(0xabcd);
  });
  test('should throw RangeError for 16-bit boundary violations', () => {
    const overflowOffset = MEMORY_SIZE_BYTES - STACK_BASE_BYTES - 1;
    expect(() => memoryWrite16(memory, SEG_DATA, STACK_BASE_BYTES + overflowOffset, 0x1234)).toThrow(
      RangeError,
    );
    expect(() => memoryRead16(memory, SEG_DATA, STACK_BASE_BYTES + overflowOffset)).toThrow(
      RangeError,
    );
  });
  test('should handle invalid dump ranges', () => {
    expect(() => memoryDump(memory, 10, 5)).toThrow(RangeError);
    expect(() => memoryDump(memory, -1, 5)).toThrow(RangeError);
    expect(() => memoryDump(memory, 0, MEMORY_SIZE_BYTES)).toThrow(RangeError);
  });
  test('should handle full float boundary conditions', () => {
    const lastCellIndex = STACK_BASE + (STACK_SIZE_BYTES / CELL_SIZE) - 1;
    memoryWriteCell(memory, lastCellIndex, 1.234);
    expect(memoryReadCell(memory, lastCellIndex)).toBeCloseTo(1.234);
    const overflowCellIndex = Math.floor((MEMORY_SIZE_BYTES - (CELL_SIZE - 1)) / CELL_SIZE);
    expect(() => memoryWriteCell(memory, overflowCellIndex, 5.678)).toThrow(RangeError);
  });

  test('should handle dumping memory as characters', () => {
    memoryWrite8(memory, SEG_DATA, STACK_BASE_BYTES + 0, 0x41);
    memoryWrite8(memory, SEG_DATA, STACK_BASE_BYTES + 1, 0x42);
    memoryWrite8(memory, SEG_DATA, STACK_BASE_BYTES + 2, 0x43);
    const base = stackBaseAddr();
    const dumpChars = memoryDumpChars(memory, base, base + 2);
    expect(dumpChars).toBe('A B C');
  });
  test('should handle invalid dumpChars ranges', () => {
    expect(() => memoryDumpChars(memory, 10, 5)).toThrow(RangeError);
    expect(() => memoryDumpChars(memory, -1, 5)).toThrow(RangeError);
    expect(() => memoryDumpChars(memory, 0, MEMORY_SIZE_BYTES)).toThrow(RangeError);
  });
});
