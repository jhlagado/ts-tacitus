import { beforeEach, describe, expect, test } from '@jest/globals';
import {
  createDataRefAbs,
  createGlobalRef,
  isRef,
  getRefRegionAbs,
  getAbsoluteByteAddressFromRef,
  readRefValueAbs,
  getVarRef,
  CELL_SIZE,
  TOTAL_DATA_BYTES,
  toTaggedValue,
  Tag,
  decodeDataRefAbs,
  RSTACK_BASE,
  SEG_DATA,
  GLOBAL_BASE,
  STACK_BASE,
} from '../../core';
import { initializeInterpreter, vm } from '../../core/global-state';
import { fetchOp, storeOp } from '../../ops/lists';

describe('DATA_REF utilities', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  test('createDataRefAbs encodes absolute cell indices and region classification', () => {
    const entries = [
      { region: 'global' as const, absIndex: GLOBAL_BASE / CELL_SIZE + 3 },
      { region: 'stack' as const, absIndex: STACK_BASE / CELL_SIZE + 5 },
      { region: 'rstack' as const, absIndex: RSTACK_BASE / CELL_SIZE + 7 },
    ];

    for (const { region, absIndex } of entries) {
      const ref = createDataRefAbs(absIndex);
      expect(isRef(ref)).toBe(true);
      expect(getRefRegionAbs(ref)).toBe(region);
      const { absoluteCellIndex } = decodeDataRefAbs(ref);
      expect(absoluteCellIndex).toBe(absIndex);
    }
  });

  test('createDataRefAbs validates absolute bounds', () => {
    const maxCell = TOTAL_DATA_BYTES / CELL_SIZE;
    expect(() => createDataRefAbs(maxCell)).toThrow('absolute cell index');
    expect(() => createDataRefAbs(-1)).toThrow('absolute cell index');
  });

  // No unsupported segments in absolute model; region classification covers windows

  test('getAbsoluteCellIndexFromRef enforces arena bounds', () => {
    const invalidAbsolute = TOTAL_DATA_BYTES / CELL_SIZE + 5;
    const bogus = toTaggedValue(invalidAbsolute, Tag.DATA_REF);
    // Use address resolver to validate bounds
    expect(() => decodeDataRefAbs(bogus)).not.toThrow();
    expect(() => getAbsoluteByteAddressFromRef(bogus)).toThrow('absolute out of bounds');
  });

  // Removed: segment-relative creation is deprecated

  test('createGlobalRef produces data ref in global segment', () => {
    const ref = createGlobalRef(12);
    const info = decodeDataRefAbs(ref);
    expect(getRefRegionAbs(ref)).toBe('global');
    expect(info.absoluteCellIndex).toBe(GLOBAL_BASE / CELL_SIZE + 12);
  });

  test('getVarRef returns DATA_REF to return-stack slot', () => {
    vm.BP = 0;
    const ref = getVarRef(vm, 2);
    const abs = decodeDataRefAbs(ref).absoluteCellIndex;
    expect(abs).toBe(RSTACK_BASE / CELL_SIZE + 2);
  });

  test('getAbsoluteByteAddressFromRef resolves absolute address', () => {
    const ref = createDataRefAbs(GLOBAL_BASE / CELL_SIZE + 4);
    const absByte = getAbsoluteByteAddressFromRef(ref);
    expect(absByte).toBe(GLOBAL_BASE + 4 * CELL_SIZE);
  });

  test('readRefValueAbs operates via DATA_REF', () => {
    const ref = createDataRefAbs(GLOBAL_BASE / CELL_SIZE + 10);
    vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE + 10 * CELL_SIZE, 321.25);
    expect(readRefValueAbs(vm, ref)).toBeCloseTo(321.25);
  });

  test('fetchOp materializes value via DATA_REF', () => {
    const cellIndex = 15;
    vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE + cellIndex * CELL_SIZE, 777.5);
    const ref = createDataRefAbs(GLOBAL_BASE / CELL_SIZE + cellIndex);
    vm.push(ref);
    fetchOp(vm);
    expect(vm.pop()).toBeCloseTo(777.5);
  });

  test('storeOp writes value via DATA_REF', () => {
    const cellIndex = 18;
    const ref = createDataRefAbs(GLOBAL_BASE / CELL_SIZE + cellIndex);
    vm.push(123.456);
    vm.push(ref);
    storeOp(vm);
    expect(vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE + cellIndex * CELL_SIZE)).toBeCloseTo(
      123.456,
    );
  });
});
