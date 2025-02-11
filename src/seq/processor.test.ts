// File: src/tests/processor.test.ts

import { Heap } from "../data/heap";
import { Memory } from "../memory";
import { UNDEF, fromTaggedValue, Tag, toTaggedValue } from "../tagged-value";
import { seqMap, seqNextProcessor, seqFilter } from "./processor";
import { seqFromRange } from "./source";

describe("Sequence Processor", () => {
  let memory: Memory;
  let heap: Heap;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  test("seqMap transforms each element", () => {
    // Create a source sequence for the range [1, 2, 3, 4, 5]
    const srcSeq = seqFromRange(heap, 1, 5);
    expect(srcSeq).not.toBe(UNDEF);

    // Create a processor sequence that maps x -> x * 2.
    const mapSeq = seqMap(heap, srcSeq, (x: number) => x * 2);
    expect(mapSeq).not.toBe(UNDEF);

    const results: number[] = [];
    for (let i = 0; i < 5; i++) {
      results.push(seqNextProcessor(heap, mapSeq));
    }
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(seqNextProcessor(heap, mapSeq)).toBe(UNDEF);
  });

  test("seqFilter returns only elements that satisfy predicate", () => {
    // Create a source sequence for the range [1..10]
    const srcSeq = seqFromRange(heap, 1, 10);
    expect(srcSeq).not.toBe(UNDEF);

    // Create a processor sequence that filters for even numbers.
    const filterSeq = seqFilter(heap, srcSeq, (x: number) => x % 2 === 0);
    expect(filterSeq).not.toBe(UNDEF);

    const results: number[] = [];
    // Expected even numbers: [2, 4, 6, 8, 10]
    for (let i = 0; i < 5; i++) {
      results.push(seqNextProcessor(heap, filterSeq));
    }
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(seqNextProcessor(heap, filterSeq)).toBe(UNDEF);
  });

  test("seqMap returns UNDEF when source sequence is invalid", () => {
    // Pass a non-tagged source sequence.
    const procSeq = seqMap(heap, 12345, (x: number) => x);
    expect(procSeq).toBe(UNDEF);
  });

  test("seqFilter returns UNDEF when source sequence is invalid", () => {
    const procSeq = seqFilter(heap, 54321, (x: number) => x % 2 === 0);
    expect(procSeq).toBe(UNDEF);
  });

  test("seqNextProcessor returns UNDEF for unknown processor type", () => {
    // Allocate a processor sequence block manually and set an invalid type.
    const procBlock = heap.malloc(64);
    expect(procBlock).not.toBe(UNDEF);
    // Write an invalid processor type (e.g., 999) at offset PROC_SEQ_TYPE (which is offset 6).
    heap.memory.write16(procBlock + 6, 999);
    // Set a valid underlying source sequence.
    const srcSeq = seqFromRange(heap, 1, 3);
    expect(srcSeq).not.toBe(UNDEF);
    const { value: srcBlock } = fromTaggedValue(Tag.SEQ, srcSeq);
    heap.memory.write16(procBlock + 4, srcBlock);

    const procSeq = toTaggedValue(Tag.SEQ, procBlock);
    expect(seqNextProcessor(heap, procSeq)).toBe(UNDEF);
  });
});
