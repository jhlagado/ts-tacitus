// File: src/tests/msource.test.ts

import { Heap } from "../data/heap";
import { Memory } from "../data/memory";
import { vectorCreate } from "../data/vector";
import { VIEW_OFFSET, VIEW_RANK, VIEW_VECTOR, viewCreate } from "../data/view";
import { seqFromVector, seqFromRange, seqFromView } from "./source";
import { UNDEF, fromTaggedValue, Tag, TAG_ANY, isUnDef } from "../tagged-value";

describe("Sequence Source (msource)", () => {
  let heap: Heap;
  let memory: Memory;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  describe("seqFromVector", () => {
    it("creates a valid sequence from a 1D vector", () => {
      const data = [10, 20, 30];
      const vec = vectorCreate(heap, data);

      const t1 = fromTaggedValue(Tag.VECTOR, vec);
      const t2 = fromTaggedValue(TAG_ANY, UNDEF);
      console.log(t1, t2, t1 == t2);

      expect(vec).toBeNaN();

      expect(isUnDef(vec)).not.toBe(true);
      const seq = seqFromVector(heap, vec);
      expect(isUnDef(seq)).not.toBe(true);
      const { value: seqBlock } = fromTaggedValue(Tag.SEQ, seq);
      // MSEQ_TOTAL is stored at offset 8; for a 1D vector the view's total should equal data length.
      const totalSlices = heap.memory.read16(seqBlock + 8);
      expect(totalSlices).toBe(3);
    });
  });

  describe("seqFromRange with shape", () => {
    it("creates a sequence from a range when shape is provided and matches count", () => {
      // Provide shape that matches count, e.g. shape [4] for count = 4.
      const seq = seqFromRange(heap, 50, 4, [4]);
      expect(isUnDef(seq)).not.toBe(true);
      const { value: seqBlock } = fromTaggedValue(Tag.SEQ, seq);
      const total = heap.memory.read16(seqBlock + 8); // MSEQ_TOTAL
      expect(total).toBe(4);
    });

    it("returns UNDEF when provided shape does not match count", () => {
      // For instance, shape [2] implies count must be 2, but count is 3.
      const seq = seqFromRange(heap, 10, 3, [2]);
      expect(seq).toBe(UNDEF);
    });
  });

  describe("seqFromRange (dynamic)", () => {
    it("creates a dynamic range sequence when no shape is provided", () => {
      const start = 200;
      const count = 5;
      const seq = seqFromRange(heap, start, count);
      expect(isUnDef(seq)).not.toBe(true);
      const { value: seqBlock } = fromTaggedValue(Tag.SEQ, seq);
      const total = heap.memory.read16(seqBlock + 8); // MSEQ_TOTAL
      expect(total).toBe(count);
    });
  });

  describe("seqFromView (error and multi-dim branches)", () => {
    it("returns UNDEF for an invalid (non-tagged) view pointer", () => {
      expect(seqFromView(heap, 12345)).toBe(UNDEF);
    });

    it("creates a sequence from a 2D view (multidimensional branch)", () => {
      // Create a 2D view by using viewCreate with shape [2, 3] so that parentRank === 2.
      const data = [1, 2, 3, 4, 5, 6];
      const vec = vectorCreate(heap, data);
      expect(isUnDef(vec)).not.toBe(true);
      const view = viewCreate(heap, vec, 0, [2, 3]);
      expect(isUnDef(view)).not.toBe(true);
      const seq = seqFromView(heap, view);
      expect(isUnDef(seq)).not.toBe(true);
      // In createSliceView, when parentRank > 1, the else branch is executed.
      // The slice view's rank should be (parentRank - 1) = 1.
      const { value: seqBlock } = fromTaggedValue(Tag.SEQ, seq);
      const sliceBlock = heap.memory.read16(seqBlock + 10); // MSEQ_SLICE_VIEW
      const sliceRank = heap.memory.read16(sliceBlock + VIEW_RANK);
      expect(sliceRank).toBe(1);
    });
  });

  describe("createDynamicRangeView (via seqFromRange dynamic)", () => {
    it("creates a dynamic range view with proper metadata", () => {
      const start = 300;
      const count = 7;
      const seq = seqFromRange(heap, start, count);
      expect(isUnDef(seq)).not.toBe(true);
      // In the dynamic branch, the parent's underlying vector pointer should equal RANGE_VIEW_MARKER.
      const { value: seqBlock } = fromTaggedValue(Tag.SEQ, seq);
      const parentBlock = heap.memory.read16(seqBlock + 4); // MSEQ_PARENT_VIEW
      const marker = heap.memory.read16(parentBlock + VIEW_VECTOR);
      expect(marker).toBe(0xffff);
      const offset = heap.memory.read16(parentBlock + VIEW_OFFSET);
      expect(offset).toBe(start);
    });
  });
});
