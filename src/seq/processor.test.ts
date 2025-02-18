// File: src/tests/processor.test.ts

import { Heap } from "../data/heap";
import { Memory } from "../data/memory";
import { vectorCreate } from "../data/vector";
import { seqFromVector } from "./source";
import {
  procMap,
  procFilter,
  procScan,
  procTake,
  procDrop,
  procSlice,
  procFlatMap,
} from "./processor";
import { seqNext } from "./sequence";
import { isUnDef } from "../tagged-value";

describe("Sequence Processors (processor)", () => {
  let heap: Heap;
  let memory: Memory;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  // Helper function to consume a sequence into an array.
  const consumeSeq = (seqPtr: number): number[] => {
    const result: number[] = [];
    let val: number;
    while (!isUnDef((val = seqNext(heap, seqPtr)))) {
      result.push(val);
    }
    return result;
  };

  it("multiplies each element by the given factor", () => {
    const data = [1, 2, 3, 4];
    const sourceSeq = seqFromVector(heap, vectorCreate(heap, data));
    expect(isUnDef(sourceSeq)).not.toBe(true);
    const mappedSeq = procMap(heap, sourceSeq, 3); // multiply each element by 3
    const result = consumeSeq(mappedSeq);
    expect(result).toEqual([3, 6, 9, 12]);
  });

  it("filters out elements below the threshold", () => {
    const data = [1, 4, 2, 5, 3, 6];
    const sourceSeq = seqFromVector(heap, vectorCreate(heap, data));
    expect(isUnDef(sourceSeq)).not.toBe(true);
    const filteredSeq = procFilter(heap, sourceSeq, 4); // allow only values >= 4
    const result = consumeSeq(filteredSeq);
    expect(result).toEqual([4, 5, 6]);
  });

  it("calculates the cumulative sum", () => {
    const data = [1, 2, 3, 4];
    const sourceSeq = seqFromVector(heap, vectorCreate(heap, data));
    expect(isUnDef(sourceSeq)).not.toBe(true);
    const scannedSeq = procScan(heap, sourceSeq, 0); // initial accumulator 0
    const result = consumeSeq(scannedSeq);
    expect(result).toEqual([1, 3, 6, 10]);
  });

  it("yields only the first n elements", () => {
    const data = [10, 20, 30, 40, 50];
    const sourceSeq = seqFromVector(heap, vectorCreate(heap, data));
    expect(isUnDef(sourceSeq)).not.toBe(true);
    const takenSeq = procTake(heap, sourceSeq, 3);
    const result = consumeSeq(takenSeq);
    expect(result).toEqual([10, 20, 30]);
  });

  it("skips the first n elements", () => {
    const data = [10, 20, 30, 40, 50];
    const sourceSeq = seqFromVector(heap, vectorCreate(heap, data));
    expect(isUnDef(sourceSeq)).not.toBe(true);
    const droppedSeq = procDrop(heap, sourceSeq, 2);
    const result = consumeSeq(droppedSeq);
    expect(result).toEqual([30, 40, 50]);
  });

  it("returns a slice starting at the given index with the specified count", () => {
    const data = [1, 2, 3, 4, 5, 6];
    const sourceSeq = seqFromVector(heap, vectorCreate(heap, data));
    expect(isUnDef(sourceSeq)).not.toBe(true);
    // Slice starting at index 2, taking 3 elements should yield [3, 4, 5]
    const slicedSeq = procSlice(heap, sourceSeq, 2, 3);
    const result = consumeSeq(slicedSeq);
    expect(result).toEqual([3, 4, 5]);
  });

  it("applies flat mapping to the source sequence", () => {
    const data = [1, 2, 3];
    const sourceSeq = seqFromVector(heap, vectorCreate(heap, data));
    expect(isUnDef(sourceSeq)).not.toBe(true);
    // For flatMap, we simply use procFlatMap which in this simplified implementation passes values through.
    const flatMappedSeq = procFlatMap(heap, sourceSeq);
    const result = consumeSeq(flatMappedSeq);
    // In this placeholder, procFlatMap does not transform values.
    expect(result).toEqual([1, 2, 3]);
  });
});
