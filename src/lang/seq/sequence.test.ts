import { vm } from "../../core/globalState";
import { Heap } from "../../core/heap";
import { Memory } from "../../core/memory";
import { toTaggedValue, NIL, PrimitiveTag } from "../../core/tagged";
import { stringCreate } from "../../data/string";
import { vectorCreate } from "../../data/vector";
import { seqNext } from "./sequence";
import {
  rangeSource,
  vectorSource,
  stringSource,
  multiSequenceSource,
} from "./source";

describe("Sequence Operations", () => {
  let memory: Memory;
  let heap: Heap;

  beforeEach(() => {
    memory = new Memory();
    heap = new Heap(memory);
  });

  it("should iterate over a range sequence", () => {
    const seq = rangeSource(heap, 1, 5, 1);
    const expected = [1, 2, 3, 4, 5];

    for (let value of expected) {
      seqNext(heap, vm, seq);
      expect(vm.pop()).toEqual(toTaggedValue(value, PrimitiveTag.INTEGER));
    }

    seqNext(heap, vm, seq);
    expect(vm.pop()).toEqual(NIL);
  });

  it("should iterate over a vector sequence", () => {
    const vector = vectorCreate(heap, [10, 20, 30]);
    const seq = vectorSource(heap, vector);
    const expected = [10, 20, 30];

    for (let value of expected) {
      seqNext(heap, vm, seq);
      expect(vm.pop()).toEqual(value);
    }

    seqNext(heap, vm, seq);
    expect(vm.pop()).toEqual(NIL);
  });

  xit("should iterate over a string sequence", () => {
    const strPtr = stringCreate(vm.digest, "abc");
    const seq = stringSource(heap, strPtr);
    const expected = ["a", "b", "c"].map((c) => stringCreate(vm.digest, c));

    for (let value of expected) {
      seqNext(heap, vm, seq);
      expect(vm.pop()).toEqual(value);
    }

    seqNext(heap, vm, seq);
    expect(vm.pop()).toEqual(NIL);
  });

  it("should iterate over a multi-sequence (zip behavior)", () => {
    const seq1 = rangeSource(heap, 1, 3, 1);
    const seq2 = vectorSource(heap, vectorCreate(heap, [100, 200, 300]));
    const multiSeq = multiSequenceSource(heap, [seq1, seq2]);

    const expected = [
      [toTaggedValue(1, PrimitiveTag.INTEGER), 100],
      [toTaggedValue(2, PrimitiveTag.INTEGER), 200],
      [toTaggedValue(3, PrimitiveTag.INTEGER), 300],
    ];

    for (let row of expected) {
      seqNext(heap, vm, multiSeq);
      const v2 = vm.pop();
      const v1 = vm.pop();
      expect([v1, v2]).toEqual(row);
    }

    seqNext(heap, vm, multiSeq);
    expect(vm.pop()).toEqual(NIL);
  });
});
