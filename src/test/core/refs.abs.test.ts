import { describe, test, expect } from '@jest/globals';
import { createDataRefAbs, decodeDataRefAbs, Tag, toTaggedValue } from '@src/core';
import { TOTAL_DATA_BYTES, CELL_SIZE } from '@src/core';

describe('Absolute DATA_REF helpers (Phase A)', () => {
  test('createDataRefAbs and decodeDataRefAbs round-trip', () => {
    const absIndex = 0; // first cell
    const ref = createDataRefAbs(absIndex);
    const { absoluteCellIndex } = decodeDataRefAbs(ref);
    expect(absoluteCellIndex).toBe(absIndex);
  });

  test('createDataRefAbs throws on out-of-bounds', () => {
    const outOfBounds = TOTAL_DATA_BYTES / CELL_SIZE; // one past last valid cell index
    expect(() => createDataRefAbs(outOfBounds)).toThrow(/out of bounds/);
  });

  test('decodeDataRefAbs rejects non-DATA_REF values', () => {
    const notRef = toTaggedValue(0, Tag.LIST);
    expect(() => decodeDataRefAbs(notRef)).toThrow(/non-DATA_REF/);
  });
});

