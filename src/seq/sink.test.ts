// File: src/tests/sink.test.ts

import { Heap } from "../data/heap";
import { Memory } from "../data/memory";
import { vectorCreate } from "../data/vector";
import {
  seqReduce,
  seqRealize,
  seqForEach,
  seqFirst,
  seqLast,
  seqFind,
  seqFindIndex,
  seqSome,
  seqEvery,
  seqCount,
} from "./sink";
import { seqFromVector } from "./source";

describe("Sequence Sinks (sink)", () => {
  let heap: Heap;
  let memory: Memory;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  describe("seqReduce", () => {
    it("reduces a sequence to a single value (sum)", () => {
      const data = [1, 2, 3, 4, 5]; // Sum: 15
      const seq = seqFromVector(heap, vectorCreate(heap, data));
      const result = seqReduce(heap, seq, (acc, val) => acc + val, 0);
      expect(result).toEqual(15);
    });
  });

  describe("seqRealize", () => {
    it("realizes the sequence into an array", () => {
      const data = [10, 20, 30, 40];
      const seq = seqFromVector(heap, vectorCreate(heap, data));
      const result = seqRealize(heap, seq);
      expect(result).toEqual(data);
    });
  });

  describe("seqForEach", () => {
    it("executes a side effect for each element", () => {
      const data = [5, 10, 15];
      const seq = seqFromVector(heap, vectorCreate(heap, data));
      const collected: number[] = [];
      seqForEach(heap, seq, (val) => collected.push(val));
      expect(collected).toEqual(data);
    });
  });

  describe("seqFirst", () => {
    it("returns the first element of the sequence", () => {
      const data = [7, 8, 9];
      const seq = seqFromVector(heap, vectorCreate(heap, data));
      const first = seqFirst(heap, seq);
      expect(first).toEqual(7);
    });
  });

  describe("seqLast", () => {
    it("returns the last element of the sequence", () => {
      const data = [1, 2, 3, 4];
      const seq = seqFromVector(heap, vectorCreate(heap, data));
      const last = seqLast(heap, seq);
      expect(last).toEqual(4);
    });
  });

  describe("seqFind", () => {
    it("finds the first element that satisfies the predicate", () => {
      const data = [3, 5, 7, 8, 9];
      const seq = seqFromVector(heap, vectorCreate(heap, data));
      const found = seqFind(heap, seq, (val) => val % 2 === 0);
      expect(found).toEqual(8);
    });
  });

  describe("seqFindIndex", () => {
    it("returns the index of the first matching element", () => {
      const data = [10, 20, 30, 40];
      const seq = seqFromVector(heap, vectorCreate(heap, data));
      const idx = seqFindIndex(heap, seq, (val) => val === 30);
      expect(idx).toEqual(2);
    });
  });

  describe("seqSome", () => {
    it("returns true if any element satisfies the predicate", () => {
      const data = [1, 3, 4];
      const seq = seqFromVector(heap, vectorCreate(heap, data));
      const result = seqSome(heap, seq, (val) => val % 2 === 0);
      expect(result).toBe(true);
    });
    it("returns false if no element satisfies the predicate", () => {
      const data = [1, 3, 5];
      const seq = seqFromVector(heap, vectorCreate(heap, data));
      const result = seqSome(heap, seq, (val) => val % 2 === 0);
      expect(result).toBe(false);
    });
  });

  describe("seqEvery", () => {
    it("returns true if all elements satisfy the predicate", () => {
      const data = [2, 4, 6];
      const seq = seqFromVector(heap, vectorCreate(heap, data));
      const result = seqEvery(heap, seq, (val) => val % 2 === 0);
      expect(result).toBe(true);
    });
    it("returns false if any element fails the predicate", () => {
      const data = [2, 3, 6];
      const seq = seqFromVector(heap, vectorCreate(heap, data));
      const result = seqEvery(heap, seq, (val) => val % 2 === 0);
      expect(result).toBe(false);
    });
  });

  describe("seqCount", () => {
    it("returns the total number of elements in the sequence", () => {
      const data = [5, 10, 15, 20];
      const seq = seqFromVector(heap, vectorCreate(heap, data));
      const count = seqCount(heap, seq);
      expect(count).toEqual(data.length);
    });
  });
});
