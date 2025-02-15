// File: src/tests/processor.test.ts

import { Heap } from "../data/heap";
import { Memory } from "../data/memory";
import { vectorCreate } from "../data/vector";
import { seqFromVector, seqFromRange } from "./source";
import {
  seqMap,
  seqScan,
  seqFilter,
  seqTake,
  seqDrop,
  seqSlice,
  seqFlatMap,
  seqZip,
  seqConcat,
} from "./processor";
import { UNDEF } from "../tagged-value";

describe("Sequence Processors (processor)", () => {
  let heap: Heap;
  let memory: Memory;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  // Helper: consume a lazy processor function into an array.
  const consume = (nextFn: () => number): number[] => {
    const res: number[] = [];
    let val;
    while ((val = nextFn()) !== UNDEF) {
      res.push(val);
    }
    return res;
  };

  describe("seqMap", () => {
    it("maps each element correctly", () => {
      const data = [1, 2, 3, 4];
      const sourceSeq = seqFromVector(heap, vectorCreate(heap, data));
      const mapper = (x: number) => x * 2;
      const nextMapped = seqMap(heap, sourceSeq, mapper);
      expect(consume(nextMapped)).toEqual([2, 4, 6, 8]);
    });
  });

  describe("seqScan", () => {
    it("performs cumulative sum correctly", () => {
      const data = [1, 2, 3, 4, 5];
      const sourceSeq = seqFromVector(heap, vectorCreate(heap, data));
      const scan = seqScan(heap, sourceSeq, 0, (acc, x) => acc + x);
      expect(consume(scan)).toEqual([1, 3, 6, 10, 15]);
    });
  });

  describe("seqFilter", () => {
    it("filters even numbers correctly", () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const sourceSeq = seqFromVector(heap, vectorCreate(heap, data));
      const filterEven = seqFilter(heap, sourceSeq, (x) => x % 2 === 0);
      expect(consume(filterEven)).toEqual([2, 4, 6, 8, 10]);
    });
  });

  describe("seqTake", () => {
    it("takes the first n elements", () => {
      const data = [10, 20, 30, 40, 50];
      const sourceSeq = seqFromVector(heap, vectorCreate(heap, data));
      const take3 = seqTake(heap, sourceSeq, 3);
      expect(consume(take3)).toEqual([10, 20, 30]);
    });
  });

  describe("seqDrop", () => {
    it("drops the first n elements", () => {
      const data = [10, 20, 30, 40, 50];
      const sourceSeq = seqFromVector(heap, vectorCreate(heap, data));
      const drop2 = seqDrop(heap, sourceSeq, 2);
      expect(consume(drop2)).toEqual([30, 40, 50]);
    });
  });

  describe("seqSlice", () => {
    it("returns a slice of the sequence", () => {
      // Expect slice from index 2, taking 2 elements, from [1,2,3,4,5] => [3,4]
      const data = [1, 2, 3, 4, 5];
      const sourceSeq = seqFromVector(heap, vectorCreate(heap, data));
      const slicer = seqSlice(heap, sourceSeq, 2, 2);
      expect(consume(slicer)).toEqual([3, 4]);
    });
  });

  describe("seqFlatMap", () => {
    it("flat maps sequences correctly", () => {
      // For each element x, produce a sequence [x, x+1]
      const data = [1, 2, 3];
      const sourceSeq = seqFromVector(heap, vectorCreate(heap, data));
      const flatMapper = (x: number) => seqFromRange(heap, x, 2); // yields [x, x+1]
      const flatMapped = seqFlatMap(heap, sourceSeq, flatMapper);
      expect(consume(flatMapped)).toEqual([1, 2, 2, 3, 3, 4]);
    });
  });

  describe("seqZip", () => {
    it("zips two sequences together", () => {
      const data1 = [1, 2, 3];
      const data2 = [4, 5, 6];
      const seq1 = seqFromVector(heap, vectorCreate(heap, data1));
      const seq2 = seqFromVector(heap, vectorCreate(heap, data2));
      const zipper = seqZip(heap, seq1, seq2);
      const res: [number, number][] = [];
      let pair;
      while ((pair = zipper()) !== UNDEF) {
        res.push(pair as [number, number]);
      }
      expect(res).toEqual([
        [1, 4],
        [2, 5],
        [3, 6],
      ]);
    });
  });

  describe("seqConcat", () => {
    it("concatenates two sequences", () => {
      const data1 = [1, 2, 3];
      const data2 = [4, 5];
      const seq1 = seqFromVector(heap, vectorCreate(heap, data1));
      const seq2 = seqFromVector(heap, vectorCreate(heap, data2));
      const concatProc = seqConcat(heap, seq1, seq2);
      expect(consume(concatProc)).toEqual([1, 2, 3, 4, 5]);
    });
  });
});
