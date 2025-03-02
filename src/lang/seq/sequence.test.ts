import { toTaggedValue, NIL, PrimitiveTag } from "../../core/tagged";
import { VM } from "../../core/vm";
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
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  it("should iterate over a range sequence", () => {
    const seq = rangeSource(vm.heap, 1, 5, 1);
    const expected = [1, 2, 3, 4, 5];

    for (let value of expected) {
      seqNext(vm.heap, vm, seq);
      expect(vm.pop()).toEqual(toTaggedValue(value, PrimitiveTag.INTEGER));
    }

    seqNext(vm.heap, vm, seq);
    expect(vm.pop()).toEqual(NIL);
  });

  it("should iterate over a vector sequence", () => {
    const vector = vectorCreate(vm.heap, [10, 20, 30]);
    const seq = vectorSource(vm.heap, vector);
    const expected = [10, 20, 30];

    for (let value of expected) {
      seqNext(vm.heap, vm, seq);
      expect(vm.pop()).toEqual(value);
    }

    seqNext(vm.heap, vm, seq);
    expect(vm.pop()).toEqual(NIL);
  });

  it("should iterate over a string sequence", () => {
    const strPtr = stringCreate(vm.digest, "abc");

    const seq = stringSource(vm.heap, strPtr);
    const expected = ["a", "b", "c"].map((c) => c.charCodeAt(0));

    for (let value of expected) {
      seqNext(vm.heap, vm, seq);
      expect(vm.pop()).toEqual(value);
    }

    seqNext(vm.heap, vm, seq);
    expect(vm.pop()).toEqual(NIL);
  });

  it("should iterate over a multi-sequence (zip behavior)", () => {
    const seq1 = rangeSource(vm.heap, 1, 3, 1);
    const seq2 = vectorSource(vm.heap, vectorCreate(vm.heap, [100, 200, 300]));
    const multiSeq = multiSequenceSource(vm.heap, [seq1, seq2]);

    const expected = [
      [toTaggedValue(1, PrimitiveTag.INTEGER), 100],
      [toTaggedValue(2, PrimitiveTag.INTEGER), 200],
      [toTaggedValue(3, PrimitiveTag.INTEGER), 300],
    ];

    for (let row of expected) {
      seqNext(vm.heap, vm, multiSeq);
      const v2 = vm.pop();
      const v1 = vm.pop();
      expect([v1, v2]).toEqual(row);
    }

    seqNext(vm.heap, vm, multiSeq);
    expect(vm.pop()).toEqual(NIL);
  });
});
