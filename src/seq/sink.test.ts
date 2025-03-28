import { describe, it, expect } from '@jest/globals';
import { VM } from '../core/vm';
import { initializeInterpreter, vm } from '../core/globalState';
import { Heap } from '../heap/heap';
import { toVector, last, forEach } from './sink';
import { seqCreate, SEQ_SRC_RANGE, SEQ_SRC_VECTOR } from './sequence';
import { NIL, fromTaggedValue, HeapTag } from '../core/tagged';
import { vectorCreate, vectorGet } from '../heap/vector';

describe('Sequence Operations', () => {
  let testVM: VM;
  let heap: Heap;

  beforeEach(() => {
    initializeInterpreter();
    testVM = vm;
    heap = testVM.heap;
    testVM.debug = false;
  });

  describe('toVector', () => {
    it('should collect a sequence of values into a vector', () => {
      const rangeSeq = seqCreate(heap, SEQ_SRC_RANGE, [1, 1, 5]);
      const vectorPtr = toVector(heap, testVM, rangeSeq);

      const { tag, heap: isHeap } = fromTaggedValue(vectorPtr);
      expect(tag).toBe(HeapTag.VECTOR);
      expect(isHeap).toBe(true);

      for (let i = 0; i < 5; i++) {
        const value = vectorGet(heap, vectorPtr, i);
        expect(value).toBe(i + 1);
      }
    });

    it('should return an empty vector for an empty sequence', () => {
      const emptySeq = seqCreate(heap, SEQ_SRC_RANGE, [10, 1, 5]);
      const vectorPtr = toVector(heap, testVM, emptySeq);

      const { tag, heap: isHeap } = fromTaggedValue(vectorPtr);
      expect(tag).toBe(HeapTag.VECTOR);
      expect(isHeap).toBe(true);

      const firstValue = vectorGet(heap, vectorPtr, 0);
      expect(firstValue).toBe(NIL);
    });
  });

  describe('last', () => {
    it('should return the last value in a sequence', () => {
      const rangeSeq = seqCreate(heap, SEQ_SRC_RANGE, [1, 1, 5]);
      const lastValue = last(heap, testVM, rangeSeq);
      expect(lastValue).toBe(5);
    });

    it('should return NIL for an empty sequence', () => {
      const emptySeq = seqCreate(heap, SEQ_SRC_RANGE, [10, 1, 5]);
      const lastValue = last(heap, testVM, emptySeq);
      expect(lastValue).toBe(NIL);
    });
  });

  describe('forEach', () => {
    it('should apply a function to each element in the sequence', () => {
      const vecPtr = vectorCreate(heap, [1, 2, 3]);
      const vectorSeq = seqCreate(heap, SEQ_SRC_VECTOR, [vecPtr]);

      const values: number[] = [];

      // Simply multiply each value by 2 in the callback
      forEach(heap, testVM, vectorSeq, value => {
        // Ensure we're working with a plain number
        values.push(Number(value) * 2);
      });

      expect(values).toEqual([2, 4, 6]);
    });

    it('should not call the function for an empty sequence', () => {
      const emptySeq = seqCreate(heap, SEQ_SRC_RANGE, [10, 1, 5]);
      let called = false;
      forEach(heap, testVM, emptySeq, () => {
        called = true;
      });
      expect(called).toBe(false);
    });
  });
});
