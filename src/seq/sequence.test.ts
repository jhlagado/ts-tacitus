// File: src/tests/sequence.test.ts

import { Heap } from "../data/heap";
import { Memory } from "../data/memory";
import { vectorCreate } from "../data/vector";
import { viewCreate, viewGet } from "../data/view";
import { seqNext, seqDup } from "./sequence";
import { seqFromView, seqFromVector } from "./source";
import { isUnDef, UNDEF } from "../tagged-value";
import * as viewModule from "../data/view";
import { NULL } from "../constants";

describe("Sequence Iterator (sequence)", () => {
  let heap: Heap;
  let memory: Memory;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  describe("1D Vector Iteration", () => {
    it("iterates over all elements in a 1D vector", () => {
      const data = [1, 2, 3, 4, 5];
      const vec = vectorCreate(heap, data);
      expect(isUnDef(vec)).not.toBe(true);
      const seq = seqFromVector(heap, vec);
      expect(isUnDef(seq)).not.toBe(true);
      const results: number[] = [];
      for (let i = 0; i < data.length; i++) {
        results.push(seqNext(heap, seq));
      }
      expect(results).toEqual(data);
      expect(seqNext(heap, seq)).toBe(UNDEF);
    });
  });

  describe("Multidimensional Iteration", () => {
    it("iterates over rows of a 2D view correctly", () => {
      const data = [10, 20, 30, 40, 50, 60];
      const vec = vectorCreate(heap, data);
      expect(isUnDef(vec)).not.toBe(true);
      const view = viewCreate(heap, vec, 0, [2, 3]); // 2 rows x 3 cols
      expect(isUnDef(view)).not.toBe(true);
      const seq = seqFromView(heap, view);
      expect(isUnDef(seq)).not.toBe(true);

      // First row
      const row0 = seqNext(heap, seq);
      expect(isUnDef(row0)).not.toBe(true);
      const row0Data: number[] = [];
      for (let j = 0; j < 3; j++) {
        row0Data.push(viewGet(heap, row0, [j]));
      }
      expect(row0Data).toEqual([10, 20, 30]);

      // Second row
      const row1 = seqNext(heap, seq);
      expect(isUnDef(row1)).not.toBe(true);
      const row1Data: number[] = [];
      for (let j = 0; j < 3; j++) {
        row1Data.push(viewGet(heap, row1, [j]));
      }
      expect(row1Data).toEqual([40, 50, 60]);

      expect(seqNext(heap, seq)).toBe(UNDEF);
    });
  });

  describe("Sequence Duplication", () => {
    it("duplicates a sequence for independent iteration", () => {
      const data = [100, 200, 300, 400];
      const seq = seqFromVector(heap, vectorCreate(heap, data));
      expect(isUnDef(seq)).not.toBe(true);
      const dupSeq = seqDup(heap, seq);
      expect(isUnDef(dupSeq)).not.toBe(true);
      // Advance original sequence by one element.
      const firstOriginal = seqNext(heap, seq);
      // Duplicate should start at the beginning.
      const firstDup = seqNext(heap, dupSeq);
      expect(firstDup).toEqual(firstOriginal);
      // Advance both sequences and compare subsequent elements.
      const secondOriginal = seqNext(heap, seq);
      const secondDup = seqNext(heap, dupSeq);
      expect(secondOriginal).toEqual(secondDup);
    });
  });

  describe("Sequence Exhaustion", () => {
    it("returns UNDEF when the sequence is exhausted", () => {
      const data = [5, 6];
      const seq = seqFromVector(heap, vectorCreate(heap, data));
      expect(isUnDef(seq)).not.toBe(true);
      expect(seqNext(heap, seq)).toEqual(5);
      expect(seqNext(heap, seq)).toEqual(6);
      expect(seqNext(heap, seq)).toBe(UNDEF);
    });
  });

  describe("Error Branches", () => {
    it("seqNext returns NULL when copyOnWrite fails on the sequence block", () => {
      const seq = seqFromVector(heap, vectorCreate(heap, [10, 20]));
      expect(isUnDef(seq)).not.toBe(true);
      const spy = jest.spyOn(heap, "copyOnWrite").mockReturnValueOnce(NULL);
      expect(seqNext(heap, seq)).toBe(NULL);
      spy.mockRestore();
    });
    it("seqNext returns NULL when copyOnWrite fails on the slice block", () => {
      const seq = seqFromVector(heap, vectorCreate(heap, [10, 20]));
      expect(isUnDef(seq)).not.toBe(true);
      // Advance one element (ensuring we're in the non-dynamic branch)
      expect(seqNext(heap, seq)).toEqual(10);
      const spy = jest
        .spyOn(heap, "copyOnWrite")
        .mockImplementation((ptr: number) => (ptr !== NULL ? NULL : ptr));
      expect(seqNext(heap, seq)).toBe(NULL);
      spy.mockRestore();
    });
    it("seqNext returns NULL when viewUpdateOffset fails", () => {
      const vec = vectorCreate(heap, [1, 2, 3, 4, 5, 6]);
      expect(isUnDef(vec)).not.toBe(true);
      const view = viewCreate(heap, vec, 0, [2, 3]);
      expect(isUnDef(view)).not.toBe(true);
      const seq = seqFromView(heap, view);
      expect(isUnDef(seq)).not.toBe(true);
      expect(isUnDef(seqNext(heap, seq))).not.toBe(true);
      const spy = jest
        .spyOn(viewModule, "viewUpdateOffset")
        .mockReturnValue(NULL);
      expect(seqNext(heap, seq)).toBe(NULL);
      spy.mockRestore();
    });
    it("seqNext and seqDup return UNDEF for invalid pointers", () => {
      expect(seqNext(heap, 99999)).toBe(UNDEF);
      expect(seqDup(heap, 99999)).toBe(UNDEF);
    });
  });
});
