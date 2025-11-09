import { beforeEach, describe, expect, test } from '@jest/globals';
import { push, pop } from '../../core/vm';
import {
  createRef,
  createGlobalRef,
  isRef,
  getRefRegion,
  getByteAddressFromRef,
  readRefValue,
  getVarRef,
  CELL_SIZE,
  TOTAL_DATA_BYTES,
  toTaggedValue,
  Tag,
  decodeRef,
  RSTACK_BASE,
  SEG_DATA,
  GLOBAL_BASE,
  STACK_BASE,
} from '../../core';
import { createVM, type VM } from '../../core/vm';
import { fetchOp, storeOp } from '../../ops/lists';
import { executeTacitCode } from '../utils/vm-test-utils';

describe('REF utilities', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('createRef encodes absolute cell indices and region classification', () => {
    const entries = [
      { region: 'global' as const, absIndex: GLOBAL_BASE / CELL_SIZE + 3 },
      { region: 'stack' as const, absIndex: STACK_BASE / CELL_SIZE + 5 },
      { region: 'rstack' as const, absIndex: RSTACK_BASE / CELL_SIZE + 7 },
    ];

    for (const { region, absIndex } of entries) {
      const ref = createRef(absIndex);
      expect(isRef(ref)).toBe(true);
      expect(getRefRegion(ref)).toBe(region);
      const { absoluteCellIndex } = decodeRef(ref);
      expect(absoluteCellIndex).toBe(absIndex);
    }
  });

  test('createRef validates absolute bounds', () => {
    const maxCell = TOTAL_DATA_BYTES / CELL_SIZE;
    expect(() => createRef(maxCell)).toThrow('absolute cell index');
    expect(() => createRef(-1)).toThrow('absolute cell index');
  });

  // No unsupported segments in absolute model; region classification covers windows

  test('getAbsoluteCellIndexFromRef enforces arena bounds', () => {
    const invalidAbsolute = TOTAL_DATA_BYTES / CELL_SIZE + 5;
    const bogus = toTaggedValue(invalidAbsolute, Tag.REF);
    // Use address resolver to validate bounds
    expect(() => decodeRef(bogus)).not.toThrow();
    expect(() => getByteAddressFromRef(bogus)).toThrow('absolute out of bounds');
  });

  // Removed: segment-relative creation is deprecated

  test('createGlobalRef produces REF in global region', () => {
    const ref = createGlobalRef(12);
    const info = decodeRef(ref);
    expect(getRefRegion(ref)).toBe('global');
    expect(info.absoluteCellIndex).toBe(GLOBAL_BASE / CELL_SIZE + 12);
  });

  test('getVarRef returns REF to return-stack slot', () => {
    vm.bp = RSTACK_BASE / CELL_SIZE + 0;
    const ref = getVarRef(vm, 2);
    const abs = decodeRef(ref).absoluteCellIndex;
    expect(abs).toBe(RSTACK_BASE / CELL_SIZE + 2);
  });

  test('getByteAddressFromRef resolves absolute address', () => {
    const ref = createRef(GLOBAL_BASE / CELL_SIZE + 4);
    const absByte = getByteAddressFromRef(ref);
    expect(absByte).toBe(GLOBAL_BASE + 4 * CELL_SIZE);
  });

  test('readRefValue operates via REF', () => {
    const ref = createRef(GLOBAL_BASE / CELL_SIZE + 10);
    vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE + 10 * CELL_SIZE, 321.25);
    expect(readRefValue(vm, ref)).toBeCloseTo(321.25);
  });

  test('fetchOp materializes value via REF', () => {
    const cellIndex = 15;
    vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE + cellIndex * CELL_SIZE, 777.5);
    const ref = createRef(GLOBAL_BASE / CELL_SIZE + cellIndex);
    push(vm, ref);
    fetchOp(vm);
    expect(pop(vm)).toBeCloseTo(777.5);
  });

  test('storeOp writes value via REF', () => {
    const cellIndex = 18;
    const ref = createRef(GLOBAL_BASE / CELL_SIZE + cellIndex);
    push(vm, 123.456);
    push(vm, ref);
    storeOp(vm);
    expect(vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE + cellIndex * CELL_SIZE)).toBeCloseTo(
      123.456,
    );
  });
});

describe('Absolute REF helpers (Phase A)', () => {
  test('createRef and decodeRef round-trip', () => {
    const absIndex = 0; // first cell
    const ref = createRef(absIndex);
    const { absoluteCellIndex } = decodeRef(ref);
    expect(absoluteCellIndex).toBe(absIndex);
  });

  test('createRef throws on out-of-bounds', () => {
    const outOfBounds = TOTAL_DATA_BYTES / CELL_SIZE; // one past last valid cell index
    expect(() => createRef(outOfBounds)).toThrow(/out of bounds/);
  });

  test('createRef throws on negative index', () => {
    expect(() => createRef(-1)).toThrow(/out of bounds/);
  });

  test('decodeRef rejects non-REF values', () => {
    const notRef = toTaggedValue(0, Tag.LIST);
    expect(() => decodeRef(notRef)).toThrow(/non-REF/);
  });
});

// Reference Formatting tests moved to refs-formatting-isolated.test.ts to avoid test isolation issues

