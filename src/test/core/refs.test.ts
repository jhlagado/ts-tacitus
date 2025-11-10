import { beforeEach, describe, expect, test } from '@jest/globals';
import { push, pop } from '../../core/vm';
import {
  createRef,
  createGlobalRef,
  isRef,
  getRefArea,
  refToByte,
  readRefValue,
  getVarRef,
  CELL_SIZE,
  TOTAL_DATA,
  toTaggedValue,
  Tag,
  decodeRef,
  RSTACK_BASE,
  GLOBAL_BASE_BYTES,
  GLOBAL_BASE,
  STACK_BASE,
} from '../../core';
import { createVM, type VM } from '../../core/vm';
import { fetchOp, storeOp } from '../../ops/lists';

describe('REF utilities', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('createRef encodes absolute cell indices and area classification', () => {
    const entries = [
      { area: 'global' as const, absIndex: GLOBAL_BASE + 3 },
      { area: 'stack' as const, absIndex: STACK_BASE + 5 },
      { area: 'rstack' as const, absIndex: RSTACK_BASE + 7 },
    ];

    for (const { area, absIndex } of entries) {
      const ref = createRef(absIndex);
      expect(isRef(ref)).toBe(true);
      expect(getRefArea(ref)).toBe(area);
      const { cellIndex } = decodeRef(ref);
      expect(cellIndex).toBe(absIndex);
    }
  });

  test('createRef validates bounds', () => {
    const maxCell = TOTAL_DATA;
    expect(() => createRef(maxCell)).toThrow('cell index');
    expect(() => createRef(-1)).toThrow('cell index');
  });

  // No unsupported segments in absolute model; area classification covers the three areas

  test('getCellFromRef enforces arena bounds', () => {
    const invalidAbsolute = TOTAL_DATA + 5;
    const bogus = toTaggedValue(invalidAbsolute, Tag.REF);
    // Use address resolver to validate bounds
    expect(() => decodeRef(bogus)).not.toThrow();
    expect(() => refToByte(bogus)).toThrow('absolute out of bounds');
  });

  // Removed: segment-relative creation is deprecated

  test('createGlobalRef produces REF in global area', () => {
    const ref = createGlobalRef(12);
    const info = decodeRef(ref);
    expect(getRefArea(ref)).toBe('global');
    expect(info.cellIndex).toBe(GLOBAL_BASE + 12);
  });

  test('getVarRef returns REF to return-stack slot', () => {
    vm.bp = RSTACK_BASE + 0;
    const ref = getVarRef(vm, 2);
    const abs = decodeRef(ref).cellIndex;
    expect(abs).toBe(RSTACK_BASE + 2);
  });

  test('refToByte resolves byte address', () => {
    const ref = createRef(GLOBAL_BASE + 4);
    const absByte = refToByte(ref);
    expect(absByte).toBe(GLOBAL_BASE_BYTES + 4 * CELL_SIZE);
  });

  test('readRefValue operates via REF', () => {
    const ref = createRef(GLOBAL_BASE + 10);
    vm.memory.writeCell(GLOBAL_BASE + 10, 321.25);
    expect(readRefValue(vm, ref)).toBeCloseTo(321.25);
  });

  test('fetchOp materializes value via REF', () => {
    const cellIndex = 15;
    vm.memory.writeCell(GLOBAL_BASE + cellIndex, 777.5);
    const ref = createRef(GLOBAL_BASE + cellIndex);
    push(vm, ref);
    fetchOp(vm);
    expect(pop(vm)).toBeCloseTo(777.5);
  });

  test('storeOp writes value via REF', () => {
    const cellIndex = 18;
    const ref = createRef(GLOBAL_BASE + cellIndex);
    push(vm, 123.456);
    push(vm, ref);
    storeOp(vm);
    expect(vm.memory.readCell(GLOBAL_BASE + cellIndex)).toBeCloseTo(123.456);
  });
});

describe('Absolute REF helpers (Phase A)', () => {
  test('createRef and decodeRef round-trip', () => {
    const absIndex = 0; // first cell
    const ref = createRef(absIndex);
    const { cellIndex } = decodeRef(ref);
    expect(cellIndex).toBe(absIndex);
  });

  test('createRef throws on out-of-bounds', () => {
    const outOfBounds = TOTAL_DATA; // one past last valid cell index
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
