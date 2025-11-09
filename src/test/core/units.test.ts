import { Memory, SEG_DATA, STACK_BASE_BYTES, STACK_BASE_CELLS } from '../../core';
import {
  cells,
  cellIndex,
  bytes,
  asBytes,
  asCells,
  loadCell,
  storeCell,
  copyCells,
  fillCells,
} from '../../core/units';

describe('cell unit helpers', () => {
  let mem: Memory;

  beforeEach(() => {
    mem = new Memory();
  });

  test('constructors validate non-negative integers', () => {
    expect(cells(0)).toBe(0);
    expect(cellIndex(3)).toBe(3);
    expect(bytes(4)).toBe(4);

    expect(() => cells(-1)).toThrow('invalid count');
    expect(() => cellIndex(1.5)).toThrow('invalid index');
    expect(() => bytes(-8)).toThrow('invalid index');
  });

  test('asBytes and asCells round-trip aligned values', () => {
    const count = cells(3);
    const offset = asBytes(count);
    expect(offset).toBe(12);
    expect(asCells(bytes(12))).toBe(count);
    expect(() => asCells(bytes(10))).toThrow('not cell-aligned');
  });

  test('loadCell and storeCell operate on cell granularity', () => {
    const baseCell = STACK_BASE_CELLS;
    const idx = cellIndex(baseCell + 2);
    storeCell(mem, SEG_DATA, idx, 42.5);
    expect(loadCell(mem, SEG_DATA, idx)).toBeCloseTo(42.5);
  });

  test('copyCells handles no-ops and overlapping ranges', () => {
    const baseCell = STACK_BASE_CELLS;
    for (let i = 0; i < 5; i++) {
      mem.writeCell(baseCell + i, i + 1);
    }

    copyCells(mem, SEG_DATA, cellIndex(baseCell + 1), cellIndex(baseCell + 1), cells(0));
    expect(mem.readCell(baseCell + 1)).toBe(2);

    copyCells(mem, SEG_DATA, cellIndex(baseCell + 2), cellIndex(baseCell + 2), cells(2));
    expect(mem.readCell(baseCell + 2)).toBe(3);

    copyCells(mem, SEG_DATA, cellIndex(baseCell + 4), cellIndex(baseCell + 0), cells(1));
    expect(mem.readCell(baseCell + 4)).toBe(1);

    for (let i = 0; i < 5; i++) {
      mem.writeCell(baseCell + i, i + 1);
    }

    copyCells(mem, SEG_DATA, cellIndex(baseCell + 0), cellIndex(baseCell + 2), cells(3));
    expect(mem.readCell(baseCell + 0)).toBe(3);
    expect(mem.readCell(baseCell + 1)).toBe(4);
    expect(mem.readCell(baseCell + 2)).toBe(5);
  });

  test('fillCells writes repeated values', () => {
    const baseCell = STACK_BASE_CELLS;
    fillCells(mem, SEG_DATA, cellIndex(baseCell + 1), cells(3), 9.75);
    expect(mem.readCell(baseCell + 1)).toBeCloseTo(9.75);
    expect(mem.readCell(baseCell + 2)).toBeCloseTo(9.75);
    expect(mem.readCell(baseCell + 3)).toBeCloseTo(9.75);
  });
});
