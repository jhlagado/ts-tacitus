// File: src/tests/sequence.test.ts

import { Heap } from "../data/heap";
import { Memory } from "../memory";
import { UNDEF } from "../tagged-value";
import { seqNext, seqDup } from "./sequence";
import { seqFromRange } from "./source";

describe("Sequence Base", () => {
  let memory: Memory;
  let heap: Heap;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  test("seqNext returns UNDEF for non-tagged pointer", () => {
    expect(seqNext(heap, 999)).toBe(UNDEF);
  });

  test("seqNext returns elements and then UNDEF when sequence is exhausted", () => {
    // Create a sequence for the range [100, 101, 102]
    const seq = seqFromRange(heap, 100, 3);
    expect(seq).not.toBe(UNDEF);

    expect(seqNext(heap, seq)).toEqual(100);
    expect(seqNext(heap, seq)).toEqual(101);
    expect(seqNext(heap, seq)).toEqual(102);
    expect(seqNext(heap, seq)).toBe(UNDEF);
  });

  test("seqDup returns UNDEF for non-tagged sequence", () => {
    expect(seqDup(heap, 8888)).toBe(UNDEF);
  });

  test("seqDup duplicates sequence state correctly", () => {
    // Create a sequence for the range [50, 51, 52, 53]
    const seq = seqFromRange(heap, 50, 4);
    expect(seq).not.toBe(UNDEF);

    // Duplicate the sequence.
    const dupSeq = seqDup(heap, seq);
    expect(dupSeq).not.toBe(UNDEF);

    // Both sequences should yield the same elements independently.
    expect(seqNext(heap, seq)).toEqual(50);
    expect(seqNext(heap, dupSeq)).toEqual(50);
    expect(seqNext(heap, seq)).toEqual(51);
    expect(seqNext(heap, dupSeq)).toEqual(51);
    expect(seqNext(heap, seq)).toEqual(52);
    expect(seqNext(heap, dupSeq)).toEqual(52);
  });
});
