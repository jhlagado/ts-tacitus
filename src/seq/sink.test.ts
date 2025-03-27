import { describe, it, expect, jest } from '@jest/globals';
import { VM } from '../core/vm';
import { initializeInterpreter, vm } from '../core/globalState';
import { Heap } from '../heap/heap';
import { toVectorSink, lastSink, forEachSink } from './sink';
import { seqCreate, SEQ_SRC_RANGE, SEQ_SRC_VECTOR, SeqType, seqNext } from './sequence';
import { NIL, fromTaggedValue } from '../core/tagged';
import { vectorCreate, vectorLength, vectorGet } from '../heap/vector';
import { SEG_HEAP } from '../core/memory';
import { CoreTag, HeapTag, toTaggedValue } from '../core/tagged';

describe('Sequence Sinks', () => {
  let testVM: VM;
  let heap: Heap;

  beforeEach(() => {
    initializeInterpreter();
    testVM = vm;
    heap = testVM.heap;
    testVM.debug = false;
  });

  describe('toVectorSink', () => {
    it('should collect a sequence of values into a vector', () => {
      // Setup
      const testVM = new VM();

      // Create a range sequence 1..5
      const rangeSeq = seqCreate(testVM.heap, SEQ_SRC_RANGE, [1, 1, 5]);

      // Mock the seqNext function to track calls
      const nextSpy = jest.spyOn(global, 'seqNext');

      // Apply the toVectorSink to collect values into a vector
      const vectorPtr = toVectorSink(testVM, rangeSeq);

      // Verify vector properties
      const { tag, heap } = fromTaggedValue(vectorPtr);
      expect(tag).toBe(HeapTag.VECTOR);
      expect(heap).toBe(true);

      // Check vector contents
      for (let i = 0; i < 5; i++) {
        const value = vectorGet(testVM.heap, vectorPtr, i);
        expect(value).toBe(i + 1);
      }

      // Verify seqNext was called appropriate number of times
      expect(nextSpy).toHaveBeenCalledTimes(6); // 5 values + 1 final call returning NIL

      // Restore original function
      nextSpy.mockRestore();
    });

    it('should return an empty vector for an empty sequence', () => {
      // Setup
      const testVM = new VM();

      // Create an empty range sequence (start > end makes it empty)
      const emptySeq = seqCreate(testVM.heap, SEQ_SRC_RANGE, [10, 1, 5]);

      // Apply the toVectorSink to collect values
      const vectorPtr = toVectorSink(testVM, emptySeq);

      // Verify vector properties
      const { tag, heap } = fromTaggedValue(vectorPtr);
      expect(tag).toBe(HeapTag.VECTOR);
      expect(heap).toBe(true);

      // Check that the vector is empty by checking the first element is NIL
      const firstValue = vectorGet(testVM.heap, vectorPtr, 0);
      expect(firstValue).toBe(NIL);
    });
  });

  describe('lastSink', () => {
    it('should return the last value in a sequence', () => {
      // Setup
      const testVM = new VM();

      // Create a range sequence 1..5
      const rangeSeq = seqCreate(testVM.heap, SEQ_SRC_RANGE, [1, 1, 5]);

      // Mock the seqNext function to track calls
      const nextSpy = jest.spyOn(global, 'seqNext');

      // Apply the lastSink to get the last value
      const lastValue = lastSink(testVM, rangeSeq);

      // Verify the result is the last value in the sequence
      expect(lastValue).toBe(5);

      // Verify seqNext was called appropriate number of times
      expect(nextSpy).toHaveBeenCalledTimes(6); // 5 values + 1 final call returning NIL

      // Restore original function
      nextSpy.mockRestore();
    });

    it('should return NIL for an empty sequence', () => {
      // Setup
      const testVM = new VM();

      // Create an empty range sequence
      const emptySeq = seqCreate(testVM.heap, SEQ_SRC_RANGE, [10, 1, 5]);

      // Apply the lastSink to get the last value
      const lastValue = lastSink(testVM, emptySeq);

      // Verify the result is NIL for an empty sequence
      expect(lastValue).toBe(NIL);
    });
  });

  describe('forEachSink', () => {
    it('should apply a function to each element in the sequence', () => {
      // Setup
      const testVM = new VM();

      // Create a vector [1, 2, 3]
      const vecValues = [1, 2, 3];
      const vecPtr = vectorCreate(testVM.heap, vecValues);

      // Create a sequence that iterates over the vector
      const vectorSeq = seqCreate(testVM.heap, SEQ_SRC_VECTOR, [vecPtr]);

      // Mock the function to track calls and values
      const values = [];
      const evalFn = jest.fn(() => {
        // In real code, this would push the value to the stack and execute a function
        // Here we're just capturing the value for testing
        const val = testVM.pop();
        values.push(val);
      });

      // Apply the forEachSink
      forEachSink(testVM, vectorSeq, toTaggedValue(0, false, CoreTag.CODE), evalFn);

      // Verify the function was called for each value with the correct arguments
      expect(evalFn).toHaveBeenCalledTimes(3);
      expect(values).toEqual([1, 2, 3]);
    });

    it('should not call the function for an empty sequence', () => {
      // Setup
      const testVM = new VM();

      // Create an empty range sequence
      const emptySeq = seqCreate(testVM.heap, SEQ_SRC_RANGE, [10, 1, 5]);

      // Mock the function
      const evalFn = jest.fn();

      // Apply the forEachSink
      forEachSink(testVM, emptySeq, toTaggedValue(0, false, CoreTag.CODE), evalFn);

      // Verify the function was never called
      expect(evalFn).not.toHaveBeenCalled();
    });
  });
});
