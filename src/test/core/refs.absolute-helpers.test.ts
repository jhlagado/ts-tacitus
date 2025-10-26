import { describe, test, expect } from '@jest/globals';
import { createDataRef, decodeDataRef, Tag, toTaggedValue } from '../../core';
import { TOTAL_DATA_BYTES, CELL_SIZE } from '../../core';

describe('Absolute DATA_REF helpers (Phase A)', () => {
  test('createDataRef and decodeDataRef round-trip', () => {
    const absIndex = 0; // first cell
    const ref = createDataRef(absIndex);
    const { absoluteCellIndex } = decodeDataRef(ref);
    expect(absoluteCellIndex).toBe(absIndex);
  });

  test('createDataRef throws on out-of-bounds', () => {
    const outOfBounds = TOTAL_DATA_BYTES / CELL_SIZE; // one past last valid cell index
    expect(() => createDataRef(outOfBounds)).toThrow(/out of bounds/);
  });

  test('createDataRef throws on negative index', () => {
    expect(() => createDataRef(-1)).toThrow(/out of bounds/);
  });

  test('decodeDataRef rejects non-DATA_REF values', () => {
    const notRef = toTaggedValue(0, Tag.LIST);
    expect(() => decodeDataRef(notRef)).toThrow(/non-DATA_REF/);
  });
});
