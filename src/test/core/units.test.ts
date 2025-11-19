import { Memory, SEG_DATA, STACK_BASE } from '../../core';
import {
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

  test('loadCell and storeCell operate on cell granularity', () => {
    const baseCell = STACK_BASE;
    const idx = baseCell + 2;
    storeCell(mem, SEG_DATA, idx, 42.5);
    expect(loadCell(mem, SEG_DATA, idx)).toBeCloseTo(42.5);
  });

  test('copyCells handles no-ops and overlapping ranges', () => {
    const baseCell = STACK_BASE;
    for (let i = 0; i < 5; i++) {
      mem.writeCell(baseCell + i, i + 1);
    }

    copyCells(mem, SEG_DATA, baseCell + 1, baseCell + 1, 0);
    expect(mem.readCell(baseCell + 1)).toBe(2);

    copyCells(mem, SEG_DATA, baseCell + 2, baseCell + 2, 2);
    expect(mem.readCell(baseCell + 2)).toBe(3);

    copyCells(mem, SEG_DATA, baseCell + 4, baseCell + 0, 1);
    expect(mem.readCell(baseCell + 4)).toBe(1);

    for (let i = 0; i < 5; i++) {
      mem.writeCell(baseCell + i, i + 1);
    }

    copyCells(mem, SEG_DATA, baseCell + 0, baseCell + 2, 3);
    expect(mem.readCell(baseCell + 0)).toBe(3);
    expect(mem.readCell(baseCell + 1)).toBe(4);
    expect(mem.readCell(baseCell + 2)).toBe(5);
  });

  test('fillCells writes repeated values', () => {
    const baseCell = STACK_BASE;
    fillCells(mem, SEG_DATA, baseCell + 1, 3, 9.75);
    expect(mem.readCell(baseCell + 1)).toBeCloseTo(9.75);
    expect(mem.readCell(baseCell + 2)).toBeCloseTo(9.75);
    expect(mem.readCell(baseCell + 3)).toBeCloseTo(9.75);
  });
});
