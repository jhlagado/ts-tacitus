// File: src/tests/source.test.ts

import { Heap } from "../data/heap";
import { vectorCreate } from "../data/vector";
import { viewCreate } from "../data/view";
import { Memory } from "../memory";
import { UNDEF } from "../tagged-value";
import { seqNext } from "./sequence";
import { seqFromRange, seqFromView } from "./source";

describe("Sequence Source", () => {
  let memory: Memory;
  let heap: Heap;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  test("seqFromRange produces a correct sequence", () => {
    // Create a sequence for the range [5, 6, 7, 8]
    const seq = seqFromRange(heap, 5, 4);
    expect(seq).not.toBe(UNDEF);

    const result: number[] = [];
    for (let i = 0; i < 4; i++) {
      result.push(seqNext(heap, seq));
    }
    expect(result).toEqual([5, 6, 7, 8]);

    // When exhausted, seqNext returns UNDEF.
    expect(seqNext(heap, seq)).toBeNaN();
  });

  test("seqFromRange returns an empty sequence when count is 0", () => {
    // Create a sequence with zero elements.
    const seq = seqFromRange(heap, 10, 0);
    expect(seq).not.toBe(UNDEF);
    // Immediately exhausted.
    expect(seqNext(heap, seq)).toBeNaN();
  });

  test("seqFromView produces a correct sequence", () => {
    // Create a vector from data.
    const vectorData = [10, 20, 30, 40];
    const vectorPtr = vectorCreate(heap, vectorData);
    expect(vectorPtr).not.toBe(UNDEF);

    // Create a 1D view covering the entire vector.
    const viewPtr = viewCreate(heap, vectorPtr, 0, [4]);
    expect(viewPtr).not.toBe(UNDEF);

    const seq = seqFromView(heap, viewPtr);
    expect(seq).not.toBe(UNDEF);

    const result: number[] = [];
    for (let i = 0; i < 4; i++) {
      result.push(seqNext(heap, seq));
    }
    expect(result).toEqual(vectorData);
    expect(seqNext(heap, seq)).toBeNaN();
  });

  test("seqFromView returns UNDEF if view dimension is not 1", () => {
    // Create a vector.
    const vectorData = [1, 2, 3, 4];
    const vectorPtr = vectorCreate(heap, vectorData);
    expect(vectorPtr).not.toBe(UNDEF);

    // Create a 2D view (shape [2,2]) from the vector.
    const viewPtr = viewCreate(heap, vectorPtr, 0, [2, 2]);
    expect(viewPtr).not.toBe(UNDEF);

    // Attempting to create a sequence from a non-1D view should fail.
    const seq = seqFromView(heap, viewPtr);
    expect(seq).toBe(UNDEF);
  });

  test("seqFromView returns UNDEF for an invalid view pointer", () => {
    // Pass a non-tagged value as the view pointer.
    const seq = seqFromView(heap, 12345);
    expect(seq).toBe(UNDEF);
  });
});
