import { NIL } from '../core/tagged';
import { VM } from '../core/vm';
import { vectorCreate } from '../heap/vector';
import { seqNext } from './sequence';
import { rangeSource, vectorSource } from './source';
import { multiSeq, mapSeq } from './processor';
import { describe, it, expect } from '@jest/globals';
import { initializeInterpreter, vm } from '../core/globalState';
import { Heap } from '../heap/heap';

describe('Sequence Processors', () => {
  let testVM: VM;
  let heap: Heap;

  beforeEach(() => {
    initializeInterpreter();
    testVM = vm;
    heap = testVM.heap;
    testVM.debug = false;
  });

  it('should process multiple sequences in parallel', () => {
    const seq1 = rangeSource(heap, 1, 3, 1);
    const seq2 = vectorSource(heap, vectorCreate(heap, [100, 200, 300]));
    const multiSeqResult = multiSeq(heap, [seq1, seq2]);

    const expected = [
      [1, 100],
      [2, 200],
      [3, 300],
    ];

    for (let row of expected) {
      seqNext(heap, testVM, multiSeqResult);
      const v1 = testVM.pop();
      const v2 = testVM.pop();
      expect(v1).toBe(row[1]);
      expect(v2).toBe(row[0]);
    }

    seqNext(heap, testVM, multiSeqResult);
    expect(testVM.pop()).toEqual(NIL);
  });

  it('should map a function over a sequence', () => {
    const source = rangeSource(heap, 1, 5, 1);
    const func = 0; // Mock function pointer
    const mappedSeq = mapSeq(heap, source, func);

    const expected = [1, 2, 3, 4, 5];
    for (let value of expected) {
      seqNext(heap, testVM, mappedSeq);
      expect(testVM.pop()).toEqual(value);
    }

    seqNext(heap, testVM, mappedSeq);
    expect(testVM.pop()).toEqual(NIL);
  });
});
