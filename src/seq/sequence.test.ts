import { isNIL, NIL } from '../core/tagged';
import { VM } from '../core/vm';
import { stringCreate } from '../core/string';
import { vectorCreate } from '../heap/vector';
import { seqNext } from './sequence';
import { rangeSource, vectorSource, stringSource } from './source';
import { describe, it, expect } from '@jest/globals';
import { initializeInterpreter, vm } from '../core/globalState';
import { Heap } from '../heap/heap';
import { seqCreate, SEQ_SRC_RANGE } from './sequence';

describe('Sequence Operations', () => {
  let testVM: VM;
  let heap: Heap;

  beforeEach(() => {
    initializeInterpreter();
    testVM = vm;
    heap = testVM.heap;
    testVM.debug = false;
  });

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

  it('should map a function over a sequence', () => {
    // Create a range sequence from 1 to 5
    const rangeSeq = seqCreate(heap, SEQ_SRC_RANGE, [1, 1, 5]);

    // Process the sequence with a safety limit
    const mappedValues: number[] = [];
    const MAX_ITERATIONS = 10; // Prevent infinite loops

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      seqNext(heap, testVM, rangeSeq);
      const value = testVM.pop();
      if (isNIL(value)) {
        break;
      } else if (i >= 5) {
        throw new Error('Sequence did not terminate with NIL after expected values');
        break;
      }

      mappedValues.push(value * 2);
    }

    // Verify results
    expect(mappedValues).toEqual([2, 4, 6, 8, 10]);
  });
});
