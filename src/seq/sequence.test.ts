import { NIL, fromTaggedValue, HeapTag, isNIL } from '../core/tagged';
import { VM } from '../core/vm';
import { stringCreate } from '../strings/string';
import { vectorCreate } from '../heap/vector';
import {
  seqNext,
  seqCreate,
  SeqSourceType,
  ProcType
} from './sequence';
import { rangeSource, vectorSource, stringSource } from './source';
import { describe, it, expect } from '@jest/globals';
import { initializeInterpreter, vm } from '../core/globalState';
import { Heap } from '../heap/heap';
import { executeProgram } from '../lang/interpreter';
import { dropSeq, mapSeq, multiSourceSeq, takeSeq } from './processor';

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
        seqNext(testVM, seq);
        expect(testVM.pop()).toEqual(value);
      }

      seqNext(testVM, seq);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should handle a range sequence with step > 1', () => {
      const seq = rangeSource(heap, 1, 10, 2);
      const expected = [1, 3, 5, 7, 9];

      for (let value of expected) {
        seqNext(testVM, seq);
        expect(testVM.pop()).toEqual(value);
      }

      seqNext(testVM, seq);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should handle an empty range sequence', () => {
      // End is less than start with positive step, produces no values
      const seq = rangeSource(heap, 5, 1, 1);

      seqNext(testVM, seq);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should iterate over a vector sequence', () => {
      const vector = vectorCreate(heap, [10, 20, 30]);
      const seq = vectorSource(heap, vector);
      const expected = [10, 20, 30];

      for (let value of expected) {
        seqNext(testVM, seq);
        expect(testVM.pop()).toEqual(value);
      }

      seqNext(testVM, seq);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should handle an empty vector sequence', () => {
      const vector = vectorCreate(heap, []);
      const seq = vectorSource(heap, vector);

      seqNext(testVM, seq);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should iterate over a string sequence', () => {
      const strPtr = stringCreate(testVM.digest, 'abc');
      const seq = stringSource(heap, strPtr);
      const expected = ['a', 'b', 'c'].map(c => c.charCodeAt(0));
      for (let value of expected) {
        seqNext(testVM, seq);
        expect(testVM.pop()).toEqual(value);
      }

      seqNext(testVM, seq);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should handle an empty string sequence', () => {
      const strPtr = stringCreate(testVM.digest, '');
      const seq = stringSource(heap, strPtr);

      seqNext(testVM, seq);
      expect(testVM.pop()).toEqual(NIL);
    });
  });

  describe('Processor Sequences', () => {
    it('should take only the first n values from a sequence', () => {
      // Create a range sequence from 1 to 10
      const rangeSeq = rangeSource(heap, 1, 10, 1);

      // Create a take processor sequence that takes only the first 3 values
      const takeSequence = takeSeq(heap, rangeSeq, 3);

      // Expected results after taking first 3
      const expected = [1, 2, 3];

      // Process the sequence and verify results
      for (let i = 0; i < expected.length; i++) {
        seqNext(testVM, takeSequence);
        const value = testVM.pop();
        expect(value).toEqual(expected[i]);
      }

      // Verify sequence termination
      seqNext(testVM, takeSequence);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should drop the first n values from a sequence', () => {
      // Create a range sequence from 1 to 10
      const rangeSeq = rangeSource(heap, 1, 10, 1);

      // Create a drop processor sequence that skips the first 7 values
      const dropSequence = dropSeq(heap, rangeSeq, 7);

      // Expected results after dropping first 7
      const expected = [8, 9, 10];

      // Process the sequence and verify results
      for (let i = 0; i < expected.length; i++) {
        seqNext(testVM, dropSequence);
        const value = testVM.pop();
        expect(value).toEqual(expected[i]);
      }

      // Verify sequence termination
      seqNext(testVM, dropSequence);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should process multiple sequences in parallel', () => {
      // Create two range sequences
      const seq1 = rangeSource(heap, 1, 3, 1);
      const seq2 = rangeSource(heap, 10, 30, 10);

      // Create a multi-source processor sequence
      const multiSequence = multiSourceSeq(heap, [seq1, seq2]);

      // Expected outputs: 1,10 followed by 2,20 followed by 3,30
      const expected = [
        [1, 10],
        [2, 20],
        [3, 30],
      ];

      // Process the sequence and verify results
      for (let i = 0; i < expected.length; i++) {
        seqNext(testVM, multiSequence);
        const v2 = testVM.pop();
        const v1 = testVM.pop();
        expect([v1, v2]).toEqual(expected[i]);
      }

      // Verify sequence termination
      seqNext(testVM, multiSequence);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should handle an unknown processor type', () => {
      // Create a range sequence
      const rangeSeq = rangeSource(heap, 1, 5, 1);

      // Create a processor sequence with an invalid processor type (999)
      const invalidProcSeq = seqCreate(heap, SeqSourceType.PROCESSOR, [rangeSeq, 999]);

      // Should just return NIL
      seqNext(testVM, invalidProcSeq);
      expect(testVM.pop()).toEqual(NIL);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle unknown sequence types gracefully', () => {
      // Create a sequence with an unknown type (999)
      const unknownSeq = seqCreate(heap, 999, [1, 1, 5]);

      // Should return NIL
      seqNext(testVM, unknownSeq);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should correctly identify sequence types', () => {
      const rangeSeq = rangeSource(heap, 1, 5, 1);
      const { tag } = fromTaggedValue(rangeSeq);
      expect(tag).toBe(HeapTag.SEQUENCE);
    });

    it('should return NIL for a NULL sequence', () => {
      seqNext(testVM, NIL);
      expect(testVM.pop()).toEqual(NIL);
    });
  });
});

describe('Enhanced Sequence Operations', () => {
  let testVM: VM;
  let heap: Heap;

  beforeEach(() => {
    initializeInterpreter();
    testVM = vm;
    heap = testVM.heap;
    testVM.debug = false;
  });

  describe('Processor Sequences - Additional Tests', () => {
    it('should handle filtering with an invalid mask sequence', () => {
      const rangeSeq = rangeSource(heap, 1, 5, 1);
      const invalidMaskSeq = rangeSource(heap, 1, 0, 1); // Invalid mask
      const siftedSeq = seqCreate(heap, SeqSourceType.PROCESSOR, [rangeSeq, invalidMaskSeq, ProcType.SIFT]);

      seqNext(testVM, siftedSeq);
      expect(testVM.pop()).toEqual(NIL); // Invalid mask should terminate sequence
    });

    it('should handle taking more elements than available', () => {
      const rangeSeq = rangeSource(heap, 1, 3, 1); // Sequence: [1, 2, 3]
      const takeSequence = takeSeq(heap, rangeSeq, 5);

      const expected = [1, 2, 3];
      for (let value of expected) {
        seqNext(testVM, takeSequence);
        expect(testVM.pop()).toEqual(value);
      }

      seqNext(testVM, takeSequence);
      expect(testVM.pop()).toEqual(NIL); // No more elements to take
    });

    it('should handle dropping more elements than available', () => {
      const rangeSeq = rangeSource(heap, 1, 3, 1); // Sequence: [1, 2, 3]
      const dropSeq = seqCreate(heap, SeqSourceType.PROCESSOR, [rangeSeq, 5, ProcType.DROP]);

      seqNext(testVM, dropSeq);
      expect(testVM.pop()).toEqual(NIL); // All elements dropped
    });

    it('should handle multi-source sequences with different lengths', () => {
      const seq1 = rangeSource(heap, 1, 3, 1); // [1, 2, 3]
      const seq2 = rangeSource(heap, 10, 20, 10); // [10, 20]
      const multiSeq = multiSourceSeq(heap, [seq1, seq2]);

      const expected = [
        [1, 10],
        [2, 20],
      ];

      for (let pair of expected) {
        seqNext(testVM, multiSeq);
        const v2 = testVM.pop();
        const v1 = testVM.pop();
        expect([v1, v2]).toEqual(pair);
      }

      seqNext(testVM, multiSeq);
      expect(testVM.pop()).toEqual(NIL); // Shorter sequence ends first
    });
  });

  describe('Error Handling - Additional Tests', () => {
    it('should handle invalid sequence type gracefully', () => {
      const invalidSeq = seqCreate(heap, 999, [1, 1, 5]); // Invalid type
      seqNext(testVM, invalidSeq);
      expect(testVM.pop()).toEqual(NIL); // Invalid type returns NIL
    });

    it('should handle corrupted sequence data', () => {
      const corruptedSeq = rangeSource(heap, 1, 'invalid' as unknown as number, 1); // Corrupted data
      seqNext(testVM, corruptedSeq);
      expect(testVM.pop()).toEqual(NIL); // Corrupted data returns NIL
    });

    it('should handle corrupted sequence data', () => {
      // Create a corrupted sequence by bypassing type checking
      const corruptedSeq = rangeSource(heap, 1, 'invalid' as unknown as number, 1); // Corrupted data
      seqNext(testVM, corruptedSeq);
      expect(testVM.pop()).toEqual(NIL); // Corrupted data returns NIL
    });
  });

  describe('Edge Cases - Additional Tests', () => {
    it('should handle nested sequences', () => {
      const innerSeq = rangeSource(heap, 1, 3, 1); // [1, 2, 3]
      const outerSeq = takeSeq(heap, innerSeq, 2); // Take first 2

      const expected = [1, 2];
      for (let value of expected) {
        seqNext(testVM, outerSeq);
        expect(testVM.pop()).toEqual(value);
      }

      seqNext(testVM, outerSeq);
      expect(testVM.pop()).toEqual(NIL); // Outer sequence ends
    });

    it('should handle sequences with non-standard step values', () => {
      const seq = rangeSource(heap, 1, 10, 2); // Sequence: [1, 3, 5, 7, 9]
      const expected = [1, 3, 5, 7, 9];

      for (let value of expected) {
        seqNext(testVM, seq);
        expect(testVM.pop()).toEqual(value);
      }

      seqNext(testVM, seq);
      expect(testVM.pop()).toEqual(NIL); // Sequence ends
    });
  });

  describe('Processor Sequences - Map Tests', () => {
    it('should map a constant function over a sequence', () => {
      // Create a range sequence from 1 to 5
      const rangeSeq = rangeSource(heap, 1, 5, 1);

      // Compile a constant function that always returns 42
      executeProgram('( drop 42 )');
      const func = vm.pop();

      // Create a map processor sequence
      const mapSequence = mapSeq(heap, rangeSeq, func);

      // Expected results after mapping
      const expected = [42, 42, 42, 42, 42];

      // Process the sequence and verify results
      for (let i = 0; i < expected.length; i++) {
        seqNext(testVM, mapSequence);
        const value = testVM.pop();
        expect(value).toEqual(expected[i]);
      }

      seqNext(testVM, mapSequence);
      let value = testVM.pop();
      expect(isNIL(value)).toBe(true);
    });

    it('should map a doubling function over a sequence', () => {
      // Create a range sequence from 1 to 5
      const rangeSeq = rangeSource(heap, 1, 5, 1);

      // Compile a function that doubles its input
      executeProgram('( 2 * )');
      const doubleFunc = vm.pop();

      // Create a map processor sequence
      const mapSequence = mapSeq(heap, rangeSeq, doubleFunc);

      // Expected results after mapping
      const expected = [2, 4, 6, 8, 10];

      // Process the sequence and verify results
      for (let i = 0; i < expected.length; i++) {
        seqNext(testVM, mapSequence);
        const value = testVM.pop();
        expect(value).toEqual(expected[i]);
      }

      // Verify sequence termination
      seqNext(testVM, mapSequence);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should handle mapping with an empty sequence', () => {
      // Create an empty range sequence
      const rangeSeq = rangeSource(heap, 0, -1, 1);

      // Compile a function that doubles its input
      executeProgram('( 2 * )');
      const doubleFunc = vm.pop();

      // Create a map processor sequence
      const mapSequence = mapSeq(heap, rangeSeq, doubleFunc);

      // Process the sequence and verify it terminates immediately
      seqNext(testVM, mapSequence);
      expect(testVM.pop()).toEqual(NIL); // No values to map
    });

    it('should handle mapping with a tacit function', () => {
      // Create a range sequence from 1 to 5
      const rangeSeq = rangeSource(heap, 1, 5, 1);

      // Compile a tacit function (e.g., square the input)
      executeProgram('( dup * )');
      const squareFunc = vm.pop();

      // Create a map processor sequence
      const mapSequence = mapSeq(heap, rangeSeq, squareFunc);

      // Expected results after mapping
      const expected = [1, 4, 9, 16, 25];

      // Process the sequence and verify results
      for (let i = 0; i < expected.length; i++) {
        seqNext(testVM, mapSequence);
        const value = testVM.pop();
        expect(value).toEqual(expected[i]);
      }

      // Verify sequence termination
      seqNext(testVM, mapSequence);
      expect(testVM.pop()).toEqual(NIL);
    });

    it('should handle mapping with a nested sequence', () => {
      // Create a vector sequence
      const vector = vectorCreate(heap, [1, 2, 3]);
      const vectorSeq = vectorSource(heap, vector);

      // Compile a function that doubles its input
      executeProgram('( 2 * )');
      const doubleFunc = vm.pop();

      // Create a map processor sequence
      const mapSequence = mapSeq(heap, vectorSeq, doubleFunc);

      // Expected results after mapping
      const expected = [2, 4, 6];

      // Process the sequence and verify results
      for (let i = 0; i < expected.length; i++) {
        seqNext(testVM, mapSequence);
        const value = testVM.pop();
        expect(value).toEqual(expected[i]);
      }

      // Verify sequence termination
      seqNext(testVM, mapSequence);
      expect(testVM.pop()).toEqual(NIL);
    });
  });
});
