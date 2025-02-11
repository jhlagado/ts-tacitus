import { Heap } from "../data/heap";
import { seqFromView, seqFromRange } from "./source";
import { vectorCreate } from "../data/vector";
import { viewCreate } from "../data/view";
import { UNDEF, toTaggedValue, Tag, fromTaggedValue } from "../tagged-value";
import { Memory } from "../memory";
import { NULL } from "../constants";

describe("Sequence Sources", () => {
  let memory: Memory;
  let heap: Heap;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  it("seqFromView returns UNDEF for non-view input", () => {
    expect(seqFromView(heap, 9999)).toBe(UNDEF); // Invalid pointer
    expect(seqFromView(heap, toTaggedValue(Tag.VECTOR, 100))).toBe(UNDEF); // Not a view
  });

  it("seqFromView returns UNDEF for non-1D views", () => {
    const vectorPtr = vectorCreate(heap, [1, 2, 3, 4]);
    const viewPtr = viewCreate(heap, vectorPtr, 0, [2, 2]); // 2D view
    expect(seqFromView(heap, viewPtr)).toBe(UNDEF);
  });

  it("seqFromView creates a sequence for a valid 1D view", () => {
    const vectorPtr = vectorCreate(heap, [1, 2, 3, 4]);
    const viewPtr = viewCreate(heap, vectorPtr, 0, [4]); // 1D view
    const seqPtr = seqFromView(heap, viewPtr);
    expect(seqPtr).not.toBe(UNDEF);
  });

  it("seqFromView handles empty views correctly", () => {
    const vectorPtr = vectorCreate(heap, []);
    const viewPtr = viewCreate(heap, vectorPtr, 0, [0]); // Empty view
    const seqPtr = seqFromView(heap, viewPtr);
    expect(seqPtr).not.toBe(UNDEF);
  });

  it("seqFromView initializes step size to 1", () => {
    const vectorPtr = vectorCreate(heap, [10, 20, 30, 40]);
    const viewPtr = viewCreate(heap, vectorPtr, 0, [4]); // 1D view
    const seqPtr = seqFromView(heap, viewPtr);

    const { value: rawSeqPtr } = fromTaggedValue(Tag.SEQ, seqPtr); // Extract the actual pointer
    expect(heap.memory.read16(rawSeqPtr + 10)).toBe(1); // Step size should be 1
});

  it("seqFromRange returns UNDEF for invalid input", () => {
    expect(seqFromRange(heap, NaN, 5)).toBe(UNDEF);
    expect(seqFromRange(heap, 5, NaN)).toBe(UNDEF);
  });

  it("seqFromRange creates a valid sequence from a range", () => {
    const seqPtr = seqFromRange(heap, 2, 5);
    expect(seqPtr).not.toBe(UNDEF);
  });

  it("seqFromRange handles zero-length ranges correctly", () => {
    const seqPtr = seqFromRange(heap, 5, 0);
    expect(seqPtr).not.toBe(UNDEF);
  });

  it("seqFromRange works with negative numbers", () => {
    const seqPtr = seqFromRange(heap, -3, 3);
    expect(seqPtr).not.toBe(UNDEF);
  });

  it("seqFromRange fails gracefully when memory allocation fails", () => {
    jest.spyOn(heap, 'malloc').mockReturnValue(NULL); // Simulate malloc failure
    const seqPtr = seqFromRange(heap, 0, 5);
    expect(seqPtr).toBe(UNDEF);
  });
});
