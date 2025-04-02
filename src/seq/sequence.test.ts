import { NIL, toTaggedValue, CoreTag, fromTaggedValue, HeapTag } from '../core/tagged';
import { VM } from '../core/vm';
import { stringCreate } from '../core/string';
import { vectorCreate } from '../heap/vector';
import {
  seqNext,
  seqCreate,
  SEQ_SRC_RANGE,
  SEQ_SRC_PROCESSOR,
  PROC_MAP,
  PROC_SIFT,
  PROC_TAKE,
  PROC_DROP,
  PROC_MULTI_SOURCE,
} from './sequence';
import { rangeSource, vectorSource, stringSource } from './source';
import { describe, it, expect } from '@jest/globals';
import { initializeInterpreter, vm } from '../core/globalState';
import { Heap } from '../heap/heap';
import { parse } from '../core/parser';
import { Tokenizer } from '../core/tokenizer';

describe('Sequence Operations', () => {
  let testVM: VM;
  let heap: Heap;

  beforeEach(() => {
    initializeInterpreter();
    testVM = vm;
    heap = testVM.heap;
    testVM.debug = false;
  });

  describe('Basic Sequence Sources', () => {
    it('should iterate over a range sequence', () => {
      const seq = rangeSource(heap, 1, 5, 1);
      const expected = [1, 2, 3, 4, 5];

      for (let value of expected) {
        seqNext(heap, testVM, seq);
        expect(testVM.pop()).toEqual(value);
      }

      seqNext(heap, testVM, seq);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should handle a range sequence with step > 1', () => {
      const seq = rangeSource(heap, 1, 10, 2);
      const expected = [1, 3, 5, 7, 9];

      for (let value of expected) {
        seqNext(heap, testVM, seq);
        expect(testVM.pop()).toEqual(value);
      }

      seqNext(heap, testVM, seq);
      expect(testVM.pop()).toEqual(NIL);
    });

    xit('should handle a descending range sequence', () => {
      const seq = rangeSource(heap, 10, 1, -1);
      const expected = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

      for (let value of expected) {
        seqNext(heap, testVM, seq);
        expect(testVM.pop()).toEqual(value);
      }

      seqNext(heap, testVM, seq);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should handle an empty range sequence', () => {
      // End is less than start with positive step, produces no values
      const seq = rangeSource(heap, 5, 1, 1);

      seqNext(heap, testVM, seq);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should iterate over a vector sequence', () => {
      const vector = vectorCreate(heap, [10, 20, 30]);
      const seq = vectorSource(heap, vector);
      const expected = [10, 20, 30];

      for (let value of expected) {
        seqNext(heap, testVM, seq);
        expect(testVM.pop()).toEqual(value);
      }

      seqNext(heap, testVM, seq);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should handle an empty vector sequence', () => {
      const vector = vectorCreate(heap, []);
      const seq = vectorSource(heap, vector);

      seqNext(heap, testVM, seq);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should iterate over a string sequence', () => {
      const strPtr = stringCreate(testVM.digest, 'abc');

      const seq = stringSource(heap, strPtr);
      const expected = ['a', 'b', 'c'].map(c => c.charCodeAt(0));

      for (let value of expected) {
        seqNext(heap, testVM, seq);
        expect(testVM.pop()).toEqual(value);
      }

      seqNext(heap, testVM, seq);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should handle an empty string sequence', () => {
      const strPtr = stringCreate(testVM.digest, '');
      const seq = stringSource(heap, strPtr);

      seqNext(heap, testVM, seq);
      expect(testVM.pop()).toEqual(NIL);
    });
  });

  describe('Processor Sequences', () => {
    xit('should map a function over a sequence', () => {
      // Create a range sequence from 1 to 5
      const rangeSeq = seqCreate(heap, SEQ_SRC_RANGE, [1, 1, 5]);

      // Create a function that doubles its input
      parse(new Tokenizer('2 *'));
      const doubleFunc = toTaggedValue(testVM.compiler.BP, false, CoreTag.CODE);

      // Create a map processor sequence
      const mapSeq = seqCreate(heap, SEQ_SRC_PROCESSOR, [rangeSeq, doubleFunc, PROC_MAP]);

      // Expected results after mapping
      const expected = [2, 4, 6, 8, 10];

      // Process the sequence and verify results
      for (let i = 0; i < expected.length; i++) {
        seqNext(heap, testVM, mapSeq);
        const value = testVM.pop();
        expect(value).toEqual(expected[i]);
      }

      // Verify sequence termination
      seqNext(heap, testVM, mapSeq);
      expect(testVM.pop()).toEqual(NIL);
    });

    xit('should filter values from a sequence', () => {
      // Create a range sequence from 1 to 10
      const rangeSeq = seqCreate(heap, SEQ_SRC_RANGE, [1, 1, 10]);

      // Create a mask sequence that keeps only odd values (index-based)
      const maskSeq = seqCreate(heap, SEQ_SRC_RANGE, [1, 2, 9]); // [1, 3, 5, 7, 9]

      // Create a filter processor sequence
      const siftedSeq = seqCreate(heap, SEQ_SRC_PROCESSOR, [rangeSeq, maskSeq, PROC_SIFT]);

      // Expected results after filtering (odd numbers)
      const expected = [1, 3, 5, 7, 9];

      // Process the sequence and verify results
      for (let i = 0; i < expected.length; i++) {
        seqNext(heap, testVM, siftedSeq);
        const value = testVM.pop();
        expect(value).toEqual(expected[i]);
      }

      // Verify sequence termination
      seqNext(heap, testVM, siftedSeq);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should take only the first n values from a sequence', () => {
      // Create a range sequence from 1 to 10
      const rangeSeq = seqCreate(heap, SEQ_SRC_RANGE, [1, 1, 10]);

      // Create a take processor sequence that takes only the first 3 values
      const takeSeq = seqCreate(heap, SEQ_SRC_PROCESSOR, [rangeSeq, 3, PROC_TAKE]);

      // Expected results after taking first 3
      const expected = [1, 2, 3];

      // Process the sequence and verify results
      for (let i = 0; i < expected.length; i++) {
        seqNext(heap, testVM, takeSeq);
        const value = testVM.pop();
        expect(value).toEqual(expected[i]);
      }

      // Verify sequence termination
      seqNext(heap, testVM, takeSeq);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should drop the first n values from a sequence', () => {
      // Create a range sequence from 1 to 10
      const rangeSeq = seqCreate(heap, SEQ_SRC_RANGE, [1, 1, 10]);

      // Create a drop processor sequence that skips the first 7 values
      const dropSeq = seqCreate(heap, SEQ_SRC_PROCESSOR, [rangeSeq, 7, PROC_DROP]);

      // Expected results after dropping first 7
      const expected = [8, 9, 10];

      // Process the sequence and verify results
      for (let i = 0; i < expected.length; i++) {
        seqNext(heap, testVM, dropSeq);
        const value = testVM.pop();
        expect(value).toEqual(expected[i]);
      }

      // Verify sequence termination
      seqNext(heap, testVM, dropSeq);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should process multiple sequences in parallel', () => {
      // Create two range sequences
      const seq1 = seqCreate(heap, SEQ_SRC_RANGE, [1, 1, 3]);
      const seq2 = seqCreate(heap, SEQ_SRC_RANGE, [10, 10, 30]);

      // Create a multi-source processor sequence
      const multiSeq = seqCreate(heap, SEQ_SRC_PROCESSOR, [seq1, seq2, PROC_MULTI_SOURCE]);

      // Expected outputs: 1,10 followed by 2,20 followed by 3,30
      const expected = [
        [1, 10],
        [2, 20],
        [3, 30],
      ];

      // Process the sequence and verify results
      for (let i = 0; i < expected.length; i++) {
        seqNext(heap, testVM, multiSeq);
        const v2 = testVM.pop();
        const v1 = testVM.pop();
        expect([v1, v2]).toEqual(expected[i]);
      }

      // Verify sequence termination
      seqNext(heap, testVM, multiSeq);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should handle an unknown processor type', () => {
      // Create a range sequence
      const rangeSeq = seqCreate(heap, SEQ_SRC_RANGE, [1, 1, 5]);

      // Create a processor sequence with an invalid processor type (999)
      const invalidProcSeq = seqCreate(heap, SEQ_SRC_PROCESSOR, [rangeSeq, 999]);

      // Should just return NIL
      seqNext(heap, testVM, invalidProcSeq);
      expect(testVM.pop()).toEqual(NIL);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle unknown sequence types gracefully', () => {
      // Create a sequence with an unknown type (999)
      const unknownSeq = seqCreate(heap, 999, [1, 1, 5]);

      // Should return NIL
      seqNext(heap, testVM, unknownSeq);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should correctly identify sequence types', () => {
      const rangeSeq = seqCreate(heap, SEQ_SRC_RANGE, [1, 1, 5]);
      const { tag } = fromTaggedValue(rangeSeq);
      expect(tag).toBe(HeapTag.SEQ);
    });

    it('should return NIL for a NULL sequence', () => {
      seqNext(heap, testVM, NIL);
      expect(testVM.pop()).toEqual(NIL);
    });
  });
});
