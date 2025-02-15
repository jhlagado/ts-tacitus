// File: src/tests/msequence.test.ts

import { Heap } from "../data/heap";
import {
  seqFromVector,
  seqFromRange,
  mseqFromView,
  mseqNext,
  seqDup,
} from "./msequence";
import { vectorCreate } from "../data/vector";
import { viewCreate, viewGet } from "../data/view";
import { UNDEF } from "../tagged-value";
import { Memory } from "../memory";

describe("Unified Sequence (msequence)", () => {
  let heap: Heap;
  let memory: Memory;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  describe("Sequence from Vector", () => {
    it("iterates over all elements in a 1D vector", () => {
      const data = [1, 2, 3, 4, 5];
      const vec = vectorCreate(heap, data);
      expect(vec).not.toBe(UNDEF);
      const seq = seqFromVector(heap, vec);
      expect(seq).not.toBe(UNDEF);
      const results: number[] = [];
      for (let i = 0; i < data.length; i++) {
        results.push(mseqNext(heap, seq));
      }
      expect(results).toEqual(data);
      expect(mseqNext(heap, seq)).toBe(UNDEF);
    });
  });

  describe("Dynamic Range Sequence", () => {
    it("lazily generates elements without realizing a full vector", () => {
      const start = 100,
        count = 10;
      const seq = seqFromRange(heap, start, count);
      expect(seq).not.toBe(UNDEF);
      const results: number[] = [];
      for (let i = 0; i < count; i++) {
        results.push(mseqNext(heap, seq));
      }
      expect(results).toEqual([
        100, 101, 102, 103, 104, 105, 106, 107, 108, 109,
      ]);
      expect(mseqNext(heap, seq)).toBe(UNDEF);
    });
  });

  describe("Multidimensional Sequence", () => {
    it("iterates over rows of a 2D view", () => {
      // Create a 2D array: 2 rows x 3 columns, with data [1,2,3,4,5,6]
      const data = [1, 2, 3, 4, 5, 6];
      const vec = vectorCreate(heap, data);
      expect(vec).not.toBe(UNDEF);
      const view = viewCreate(heap, vec, 0, [2, 3]);
      expect(view).not.toBe(UNDEF);
      const seq = mseqFromView(heap, view);
      expect(seq).not.toBe(UNDEF);
      const row0 = mseqNext(heap, seq);
      expect(row0).not.toBe(UNDEF);
      const row0Data: number[] = [];
      for (let j = 0; j < 3; j++) {
        row0Data.push(viewGet(heap, row0, [j]));
      }
      expect(row0Data).toEqual([1, 2, 3]);
      const row1 = mseqNext(heap, seq);
      expect(row1).not.toBe(UNDEF);
      const row1Data: number[] = [];
      for (let j = 0; j < 3; j++) {
        row1Data.push(viewGet(heap, row1, [j]));
      }
      expect(row1Data).toEqual([4, 5, 6]);
      expect(mseqNext(heap, seq)).toBe(UNDEF);
    });
  });

  describe("Sequence Duplication", () => {
    it("duplicates a sequence for independent iteration", () => {
      const data = [7, 8, 9];
      const vec = vectorCreate(heap, data);
      expect(vec).not.toBe(UNDEF);
      const seq = seqFromVector(heap, vec);
      expect(seq).not.toBe(UNDEF);
      const dup = seqDup(heap, seq);
      expect(dup).not.toBe(UNDEF);
      // Advance the original sequence by one element.
      const origFirst = mseqNext(heap, seq);
      // The duplicate should start at the beginning.
      const dupFirst = mseqNext(heap, dup);
      expect(origFirst).toEqual(dupFirst);
      // Advance both and compare.
      const origSecond = mseqNext(heap, seq);
      const dupSecond = mseqNext(heap, dup);
      expect(origSecond).toEqual(dupSecond);
    });
  });

  describe("Sequence Exhaustion", () => {
    it("returns UNDEF when sequence is exhausted", () => {
      const data = [1, 2];
      const seq = seqFromVector(heap, vectorCreate(heap, data));
      expect(seq).not.toBe(UNDEF);
      // Consume all elements.
      mseqNext(heap, seq);
      mseqNext(heap, seq);
      expect(mseqNext(heap, seq)).toBe(UNDEF);
    });
  });

    it("iterates over all elements in a 1D vector correctly", () => {
    const data = [1, 2, 3, 4, 5];
    const vec = vectorCreate(heap, data);
    expect(vec).not.toBe(UNDEF);
    const seq = seqFromVector(heap, vec);
    expect(seq).not.toBe(UNDEF);
    const results: number[] = [];
    for (let i = 0; i < data.length; i++) {
      results.push(mseqNext(heap, seq));
    }
    expect(results).toEqual(data);
    expect(mseqNext(heap, seq)).toBe(UNDEF);
  });

  it("iterates over rows of a 2D view correctly", () => {
    // Create a 2D array: 3 rows x 4 columns.
    // Data in row-major order: [1,2,3,4, 5,6,7,8, 9,10,11,12]
    const data = [1,2,3,4, 5,6,7,8, 9,10,11,12];
    const vec = vectorCreate(heap, data);
    expect(vec).not.toBe(UNDEF);
    // Create a 2D view with shape [3, 4]
    const view = viewCreate(heap, vec, 0, [3,4]);
    expect(view).not.toBe(UNDEF);
    const seq = mseqFromView(heap, view);
    expect(seq).not.toBe(UNDEF);

    // For a 2D view, parent's rank is 2, so each slice (row) should be a view with rank 1.
    const row0 = mseqNext(heap, seq);
    expect(row0).not.toBe(UNDEF);
    const row0Data: number[] = [];
    for (let j = 0; j < 4; j++) {
      row0Data.push(viewGet(heap, row0, [j]));
    }
    expect(row0Data).toEqual([1,2,3,4]);

    const row1 = mseqNext(heap, seq);
    expect(row1).not.toBe(UNDEF);
    const row1Data: number[] = [];
    for (let j = 0; j < 4; j++) {
      row1Data.push(viewGet(heap, row1, [j]));
    }
    expect(row1Data).toEqual([5,6,7,8]);

    const row2 = mseqNext(heap, seq);
    expect(row2).not.toBe(UNDEF);
    const row2Data: number[] = [];
    for (let j = 0; j < 4; j++) {
      row2Data.push(viewGet(heap, row2, [j]));
    }
    expect(row2Data).toEqual([9,10,11,12]);

    // Ensure that no more rows are available.
    expect(mseqNext(heap, seq)).toBe(UNDEF);
  });

  it("duplicates a sequence and iterates independently", () => {
    const data = [100, 200, 300, 400];
    const vec = vectorCreate(heap, data);
    expect(vec).not.toBe(UNDEF);
    const seq = seqFromVector(heap, vec);
    expect(seq).not.toBe(UNDEF);
    const dupSeq = seqDup(heap, seq);
    expect(dupSeq).not.toBe(UNDEF);

    // Advance original sequence by one element.
    const firstOriginal = mseqNext(heap, seq);
    // The duplicate should still yield the first element.
    const firstDup = mseqNext(heap, dupSeq);
    expect(firstDup).toEqual(firstOriginal);

    // Advance both sequences and compare subsequent elements.
    const secondOriginal = mseqNext(heap, seq);
    const secondDup = mseqNext(heap, dupSeq);
    expect(secondOriginal).toEqual(secondDup);
  });

  it("handles dynamic range sequences correctly", () => {
    const start = 1000, count = 10;
    const seq = seqFromRange(heap, start, count);
    expect(seq).not.toBe(UNDEF);
    const results: number[] = [];
    for (let i = 0; i < count; i++) {
      results.push(mseqNext(heap, seq));
    }
    // Expect the sequence to produce numbers from 1000 to 1009.
    expect(results).toEqual([1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009]);
    expect(mseqNext(heap, seq)).toBe(UNDEF);
  });


  describe("Additional msequence Tests", () => {
  
    it("iterates over all elements in a 1D vector correctly", () => {
      const data = [1, 2, 3, 4, 5];
      const vec = vectorCreate(heap, data);
      expect(vec).not.toBe(UNDEF);
      const seq = seqFromVector(heap, vec);
      expect(seq).not.toBe(UNDEF);
      const results: number[] = [];
      for (let i = 0; i < data.length; i++) {
        results.push(mseqNext(heap, seq));
      }
      expect(results).toEqual(data);
      expect(mseqNext(heap, seq)).toBe(UNDEF);
    });
  
    it("iterates over rows of a 2D view correctly", () => {
      // Create a 2D array: 3 rows x 4 columns.
      // Data in row-major order: [1,2,3,4, 5,6,7,8, 9,10,11,12]
      const data = [1,2,3,4, 5,6,7,8, 9,10,11,12];
      const vec = vectorCreate(heap, data);
      expect(vec).not.toBe(UNDEF);
      // Create a 2D view with shape [3, 4]
      const view = viewCreate(heap, vec, 0, [3,4]);
      expect(view).not.toBe(UNDEF);
      const seq = mseqFromView(heap, view);
      expect(seq).not.toBe(UNDEF);
  
      // For a 2D view, parent's rank is 2, so each slice (row) should be a view with rank 1.
      const row0 = mseqNext(heap, seq);
      expect(row0).not.toBe(UNDEF);
      const row0Data: number[] = [];
      for (let j = 0; j < 4; j++) {
        row0Data.push(viewGet(heap, row0, [j]));
      }
      expect(row0Data).toEqual([1,2,3,4]);
  
      const row1 = mseqNext(heap, seq);
      expect(row1).not.toBe(UNDEF);
      const row1Data: number[] = [];
      for (let j = 0; j < 4; j++) {
        row1Data.push(viewGet(heap, row1, [j]));
      }
      expect(row1Data).toEqual([5,6,7,8]);
  
      const row2 = mseqNext(heap, seq);
      expect(row2).not.toBe(UNDEF);
      const row2Data: number[] = [];
      for (let j = 0; j < 4; j++) {
        row2Data.push(viewGet(heap, row2, [j]));
      }
      expect(row2Data).toEqual([9,10,11,12]);
  
      // Ensure that no more rows are available.
      expect(mseqNext(heap, seq)).toBe(UNDEF);
    });
  
    it("duplicates a sequence and iterates independently", () => {
      const data = [100, 200, 300, 400];
      const vec = vectorCreate(heap, data);
      expect(vec).not.toBe(UNDEF);
      const seq = seqFromVector(heap, vec);
      expect(seq).not.toBe(UNDEF);
      const dupSeq = seqDup(heap, seq);
      expect(dupSeq).not.toBe(UNDEF);
  
      // Advance original sequence by one element.
      const firstOriginal = mseqNext(heap, seq);
      // The duplicate should still yield the first element.
      const firstDup = mseqNext(heap, dupSeq);
      expect(firstDup).toEqual(firstOriginal);
  
      // Advance both sequences and compare subsequent elements.
      const secondOriginal = mseqNext(heap, seq);
      const secondDup = mseqNext(heap, dupSeq);
      expect(secondOriginal).toEqual(secondDup);
    });
  
    it("handles dynamic range sequences correctly", () => {
      const start = 1000, count = 10;
      const seq = seqFromRange(heap, start, count);
      expect(seq).not.toBe(UNDEF);
      const results: number[] = [];
      for (let i = 0; i < count; i++) {
        results.push(mseqNext(heap, seq));
      }
      // Expect the sequence to produce numbers from 1000 to 1009.
      expect(results).toEqual([1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009]);
      expect(mseqNext(heap, seq)).toBe(UNDEF);
    });
  });
  
});
