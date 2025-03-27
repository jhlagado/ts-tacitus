import { describe, it, expect, jest } from '@jest/globals';
import { VM } from '../core/vm';
import { initializeInterpreter, vm } from '../core/globalState';
import { Heap } from '../heap/heap';
import { scanProcessor, filterProcessor } from './processor';
import { seqCreate, SEQ_SRC_RANGE, SEQ_SRC_VECTOR, SeqType } from './sequence';
import { NIL, toTaggedValue, CoreTag } from '../core/tagged';
import { vectorCreate } from '../heap/vector';
import { HEAP_SIZE, SEG_HEAP } from '../core/memory';

describe('Sequence Processors', () => {
  let testVM: VM;
  let heap: Heap;

  beforeEach(() => {
    initializeInterpreter();
    testVM = vm;
    heap = testVM.heap;
    testVM.debug = false;
  });

  describe('scanProcessor', () => {
    it('should process a range sequence with a function that doubles each value', () => {
      // Setup
      const rangeSeq = seqCreate(testVM, SeqType.RANGE, 1, 5, 1);

      // Create a scan processor with a function that doubles each value
      const evalFn = jest.fn().mockImplementation(() => {
        // Double the value on top of the stack
        const value = testVM.pop();
        testVM.push(value * 2);
      });

      // Count how many values were processed
      let count = 0;
      let sum = 0;

      // Apply the scan processor to process each value
      const processor = scanProcessor(testVM, rangeSeq, toTaggedValue(0, false, CoreTag.CODE), evalFn);

      // Process each value
      let value = processor.next(testVM);
      while (value !== NIL) {
        count++;
        sum += value;
        value = processor.next(testVM);
      }

      // Verify
      expect(count).toBe(5); // 5 values in the sequence
      expect(sum).toBe(2 + 4 + 6 + 8 + 10); // Sum of doubled values 1-5
      expect(evalFn).toHaveBeenCalledTimes(5); // Function called once per value
    });

    it('should handle an empty sequence', () => {
      // Setup
      const rangeSeq = seqCreate(testVM, SeqType.RANGE, 1, 0, 1); // Start > end means empty

      // Create a scan processor
      const evalFn = jest.fn();

      const processor = scanProcessor(testVM, rangeSeq, toTaggedValue(0, false, CoreTag.CODE), evalFn);

      // Process sequence
      const value = processor.next(testVM);

      // Verify
      expect(value).toBe(NIL); // Empty sequence returns NIL immediately
      expect(evalFn).not.toHaveBeenCalled(); // Function never called for empty sequence
    });
  });

  describe('filterProcessor', () => {
    it('should filter a sequence based on a predicate function', () => {
      // Setup
      const rangeSeq = seqCreate(testVM, SeqType.RANGE, 1, 10, 1);

      // Create a filter processor that keeps only even numbers
      const evalFn = jest.fn().mockImplementation(() => {
        // Get the value without popping
        const val = testVM.getStackData()[testVM.SP / 4 - 1]; // Get last value in the stack
        const isEven = val % 2 === 0;

        // Replace top of stack with boolean result (1 for true, 0 for false)
        testVM.pop(); // Remove the original value
        testVM.push(isEven ? 1 : 0); // Push the predicate result
      });

      // Apply the filter processor to get only even numbers
      const processor = filterProcessor(testVM, rangeSeq, toTaggedValue(0, false, CoreTag.CODE), evalFn);

      // Process and collect filtered values
      const filteredValues = [];
      let value = processor.next(testVM);
      while (value !== NIL) {
        filteredValues.push(value);
        value = processor.next(testVM);
      }

      // Verify
      expect(filteredValues).toEqual([2, 4, 6, 8, 10]); // Only even numbers
      expect(evalFn).toHaveBeenCalledTimes(10); // Predicate called for each value
    });

    it('should handle an empty sequence', () => {
      // Setup
      const rangeSeq = seqCreate(testVM, SeqType.RANGE, 1, 0, 1); // Start > end means empty

      // Create a filter processor
      const evalFn = jest.fn();

      const processor = filterProcessor(testVM, rangeSeq, toTaggedValue(0, false, CoreTag.CODE), evalFn);

      // Process sequence
      const value = processor.next(testVM);

      // Verify
      expect(value).toBe(NIL); // Empty sequence returns NIL immediately
      expect(evalFn).not.toHaveBeenCalled(); // Function never called for empty sequence
    });
  });
});
