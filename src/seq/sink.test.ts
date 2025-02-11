
// File: src/tests/sink.test.ts

import { Heap } from "../data/heap";
import { Memory } from "../memory";
import { UNDEF } from "../tagged-value";
import { seqReduce, seqRealize, seqForEach } from "./sink";
import { seqFromRange } from "./source";

describe("Sequence Sink", () => {
  let memory: Memory;
  let heap: Heap;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  test("seqReduce sums elements correctly", () => {
    // Create a sequence for the range [1, 2, 3, 4, 5]
    const seq = seqFromRange(heap, 1, 5);
    expect(seq).not.toBe(UNDEF);

    const sum = seqReduce(heap, seq, 0, (acc: number, x: number) => acc + x);
    expect(sum).toEqual(15);
  });

  test("seqRealize returns an array of elements", () => {
    // Create a sequence for the range [10, 11, 12, 13]
    const seq = seqFromRange(heap, 10, 4);
    expect(seq).not.toBe(UNDEF);

    const realized = seqRealize(heap, seq);
    expect(realized).toEqual([10, 11, 12, 13]);
  });

  test("seqForEach applies a consumer function", () => {
    // Create a sequence for the range [20, 21, 22]
    const seq = seqFromRange(heap, 20, 3);
    expect(seq).not.toBe(UNDEF);

    const collected: number[] = [];
    seqForEach(heap, seq, (x: number) => {
      collected.push(x);
    });
    expect(collected).toEqual([20, 21, 22]);
  });
});
