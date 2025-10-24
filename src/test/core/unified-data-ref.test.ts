import { beforeEach, describe, expect, test } from '@jest/globals';
import {
  createDataRef,
  createSegmentRef,
  createGlobalRef,
  decodeDataRef,
  isRef,
  getRefSegment,
  resolveReference,
  readReference,
  writeReference,
  getVarRef,
  STACK_SIZE,
  RSTACK_SIZE,
  CELL_SIZE,
  TOTAL_DATA_BYTES,
  toTaggedValue,
  Tag,
  decodeDataRefAbs,
  RSTACK_BASE,
  SEG_DATA,
  GLOBAL_BASE,
} from '../../core';
import { initializeInterpreter, vm } from '../../core/global-state';
import { fetchOp, storeOp } from '../../ops/lists';

describe('DATA_REF utilities', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  test('createDataRef encodes segment-relative cell indices', () => {
    const refs = [
      { segment: 2, cellIndex: 3 },
      { segment: 0, cellIndex: 5 },
      { segment: 1, cellIndex: 7 }, // return-stack region id
    ];

    for (const { segment, cellIndex } of refs) {
      const ref = createDataRef(segment, cellIndex);
      expect(isRef(ref)).toBe(true);
      expect(getRefSegment(ref)).toBe(segment);
      const components = decodeDataRef(ref);
      expect(components.segment).toBe(segment);
      expect(components.cellIndex).toBe(cellIndex);
    }
  });

  test('createDataRef validates segment bounds', () => {
    expect(() => createDataRef(0, STACK_SIZE / CELL_SIZE)).toThrow();
    expect(() => createDataRef(1, RSTACK_SIZE / CELL_SIZE)).toThrow();
    expect(() => createDataRef(0, -1)).toThrow();
  });

  test('createDataRef rejects unsupported segments', () => {
    expect(() => createDataRef(1234, 0)).toThrow('Unsupported DATA_REF segment');
  });

  test('decodeDataRef enforces arena bounds', () => {
    const invalidAbsolute = TOTAL_DATA_BYTES / CELL_SIZE + 5;
    const bogus = toTaggedValue(invalidAbsolute, Tag.DATA_REF);
    expect(() => decodeDataRef(bogus)).toThrow('DATA_REF absolute cell index');
  });

  test('createSegmentRef mirrors createDataRef', () => {
    const ref = createSegmentRef(0, 4);
    const dataRef = createDataRef(0, 4);
    expect(ref).toBe(dataRef);
  });

  test('createGlobalRef produces data ref in global segment', () => {
    const ref = createGlobalRef(12);
    const info = decodeDataRef(ref);
    expect(info.segment).toBe(2);
    expect(info.cellIndex).toBe(12);
  });

  test('getVarRef returns DATA_REF to return-stack slot', () => {
    vm.BP = 0;
    const ref = getVarRef(vm, 2);
    const abs = decodeDataRefAbs(ref).absoluteCellIndex;
    expect(abs).toBe(RSTACK_BASE / CELL_SIZE + 2);
  });

  test('resolveReference returns segment-address pair', () => {
    const ref = createDataRef(2, 4);
    const resolved = resolveReference(vm, ref);
    expect(resolved.segment).toBe(2);
    expect(resolved.address).toBe(4 * CELL_SIZE);
  });

  test('readReference and writeReference operate via DATA_REF', () => {
    const ref = createDataRef(2, 10);
    writeReference(vm, ref, 321.25);
    expect(readReference(vm, ref)).toBeCloseTo(321.25);
  });

  test('fetchOp materializes value via DATA_REF', () => {
    const cellIndex = 15;
    vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE + cellIndex * CELL_SIZE, 777.5);
    const ref = createDataRef(2, cellIndex);
    vm.push(ref);
    fetchOp(vm);
    expect(vm.pop()).toBeCloseTo(777.5);
  });

  test('storeOp writes value via DATA_REF', () => {
    const cellIndex = 18;
    const ref = createDataRef(2, cellIndex);
    vm.push(123.456);
    vm.push(ref);
    storeOp(vm);
    expect(vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE + cellIndex * CELL_SIZE)).toBeCloseTo(
      123.456,
    );
  });
});
