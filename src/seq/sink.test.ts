import { describe, it, expect } from '@jest/globals';
import { VM } from '../core/vm';
import { initializeInterpreter, vm } from '../core/globalState';
import { Heap } from '../heap/heap';
import { toVector, last, forEach, count, reduce, find, any, all } from './sink';
import { seqCreate, SEQ_SRC_VECTOR } from './sequence';
import { NIL, fromTaggedValue, HeapTag, toTaggedValue, CoreTag } from '../core/tagged';
import { vectorCreate, vectorGet } from '../heap/vector';
import { parse } from '../lang/parser';
import { Tokenizer } from '../lang/tokenizer';
import { rangeSource } from './source';
import { executeProgram } from '../lang/interpreter';

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
      const rangeSeq = rangeSource(heap, 1, 5, 1);
      const vectorPtr = toVector(heap, testVM, rangeSeq);

      const { tag, isHeap } = fromTaggedValue(vectorPtr);
      expect(tag).toBe(HeapTag.VECTOR);
      expect(isHeap).toBe(true);

      for (let i = 0; i < 5; i++) {
        const value = vectorGet(heap, vectorPtr, i);
        expect(value).toBe(i + 1);
      }
    });

    it('should return an empty vector for an empty sequence', () => {
      const emptySeq = rangeSource(heap, 10, 5, 1);
      const vectorPtr = toVector(heap, testVM, emptySeq);

      const { tag, isHeap } = fromTaggedValue(vectorPtr);
      expect(tag).toBe(HeapTag.VECTOR);
      expect(isHeap).toBe(true);

      const firstValue = vectorGet(heap, vectorPtr, 0);
      expect(firstValue).toBe(NIL);
    });
  });

  describe('last', () => {
    it('should return the last value in a sequence', () => {
      const rangeSeq = rangeSource(heap, 1, 5, 1);
      const lastValue = last(heap, testVM, rangeSeq);
      expect(lastValue).toBe(5);
    });

    it('should return NIL for an empty sequence', () => {
      const emptySeq = rangeSource(heap, 10, 5, 1);
      const lastValue = last(heap, testVM, emptySeq);
      expect(lastValue).toBe(NIL);
    });
  });

  describe('forEach', () => {
    it('should apply a function to each element in the sequence', () => {
      const vecPtr = vectorCreate(heap, [1, 2, 3]);
      const vectorSeq = seqCreate(heap, SEQ_SRC_VECTOR, [vecPtr]);

      executeProgram('( . )');
      const func = vm.pop();

      const output: string[] = [];
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        output.push(args.join(' '));
        originalConsoleLog(...args);
      };
      // Simply multiply each value by 2 in the callback
      forEach(heap, testVM, vectorSeq, func);
      console.log = originalConsoleLog; // Restore original console.log
      console.log('Captured Output:', output);
      expect(output).toEqual(['1', '2', '3']);
    });
  });

  describe('count', () => {
    it('should return the number of elements in a sequence', () => {
      const rangeSeq = rangeSource(heap, 1, 5, 1);
      const countValue = count(heap, testVM, rangeSeq);
      expect(countValue).toBe(5);
    });

    it('should return 0 for an empty sequence', () => {
      const emptySeq = rangeSource(heap, 10, 5, 1);
      const countValue = count(heap, testVM, emptySeq);
      expect(countValue).toBe(0);
    });

    it('should properly count a vector sequence', () => {
      const vecPtr = vectorCreate(heap, [42, 43, 44, 45]);
      const vectorSeq = seqCreate(heap, SEQ_SRC_VECTOR, [vecPtr]);
      const countValue = count(heap, testVM, vectorSeq);
      expect(countValue).toBe(4);
    });
  });

  describe('reduce', () => {
    it('should return the initial value for an empty sequence', () => {
      // Create a code block function
      parse(new Tokenizer('+'));
      const addFunc = toTaggedValue(testVM.compiler.BP, false, CoreTag.CODE);

      // Create an empty sequence
      const emptySeq = rangeSource(heap, 10, 5, 1);

      // Reduce with initial value 42
      const result = reduce(heap, testVM, emptySeq, addFunc, 42, () => testVM.eval());

      expect(result).toBe(42);
    });
  });

  describe('find', () => {
    it('should return NIL for an empty sequence', () => {
      // Create a code block function
      parse(new Tokenizer('0 >'));
      const predFunc = toTaggedValue(testVM.compiler.BP, false, CoreTag.CODE);

      // Create an empty sequence
      const emptySeq = rangeSource(heap, 10, 5, 1);

      const result = find(heap, testVM, emptySeq, predFunc, () => testVM.eval());

      expect(result).toBe(NIL);
    });
  });

  describe('any', () => {
    it('should return 1 if any value matches the predicate', () => {
      // Create a code block function that checks if a value is equal to 3
      parse(new Tokenizer('3 ='));
      const equalsThreeFunc = toTaggedValue(testVM.compiler.BP, false, CoreTag.CODE);

      // Create a range sequence from 1 to 5
      const rangeSeq = rangeSource(heap, 1, 5, 1);

      // Check if any value equals 3
      const result = any(heap, testVM, rangeSeq, equalsThreeFunc, () => testVM.eval());

      expect(result).toBe(1);
    });

    it('should return 0 for an empty sequence', () => {
      // Create a code block function
      parse(new Tokenizer('0 >'));
      const predFunc = toTaggedValue(testVM.compiler.BP, false, CoreTag.CODE);

      // Create an empty sequence
      const emptySeq = rangeSource(heap, 10, 5, 1);

      const result = any(heap, testVM, emptySeq, predFunc, () => testVM.eval());

      expect(result).toBe(0);
    });
  });

  describe('all', () => {
    it('should return 1 if all values match the predicate', () => {
      // Create a code block function that checks if a value is less than 10
      parse(new Tokenizer('10 <'));
      const lessThanTenFunc = toTaggedValue(testVM.compiler.BP, false, CoreTag.CODE);

      // Create a range sequence from 1 to 5
      const rangeSeq = rangeSource(heap, 1, 5, 1);

      // Check if all values are less than 10
      const result = all(heap, testVM, rangeSeq, lessThanTenFunc, () => testVM.eval());

      expect(result).toBe(1);
    });

    it('should return 1 for an empty sequence', () => {
      // Create a code block function
      parse(new Tokenizer('0 >'));
      const predFunc = toTaggedValue(testVM.compiler.BP, false, CoreTag.CODE);

      // Create an empty sequence
      const emptySeq = rangeSource(heap, 10, 5, 1);

      const result = all(heap, testVM, emptySeq, predFunc, () => testVM.eval());

      expect(result).toBe(1);
    });
  });
});
