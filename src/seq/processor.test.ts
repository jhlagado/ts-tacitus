import { CoreTag, NIL, toTaggedValue } from '../core/tagged';
import { vectorCreate } from '../heap/vector';
import { seqNext } from './sequence';
import { rangeSource, vectorSource } from './source';
import { multiSeq, mapSeq, siftSeq, takeSeq, dropSeq, scanSeq, chainSeq } from './processor';
import { describe, it, expect } from '@jest/globals';
import { initializeInterpreter, vm } from '../core/globalState';
import { parse } from '../core/parser';
import { Tokenizer } from '../core/tokenizer';

describe('Sequence Processors', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  it('should process multiple sequences in parallel', () => {
    const seq1 = rangeSource(vm.heap, 1, 3, 1);
    const seq2 = vectorSource(vm.heap, vectorCreate(vm.heap, [100, 200, 300]));
    const multiSeqResult = multiSeq(vm.heap, [seq1, seq2]);

    const expected = [
      [1, 100],
      [2, 200],
      [3, 300],
    ];

    for (let row of expected) {
      seqNext(vm.heap, vm, multiSeqResult);
      const v1 = vm.pop();
      const v2 = vm.pop();
      expect(v1).toBe(row[1]);
      expect(v2).toBe(row[0]);
    }

    seqNext(vm.heap, vm, multiSeqResult);
    expect(vm.pop()).toEqual(NIL);
  });

  xit('should map a function over a sequence', () => {
    const source = rangeSource(vm.heap, 1, 5, 1);

    // Create a function that doubles its input
    parse(new Tokenizer('2 *'));
    const doubleFunc = toTaggedValue(vm.compiler.BP, false, CoreTag.CODE);

    const mappedSeq = mapSeq(vm.heap, source, doubleFunc);

    const expected = [2, 4, 6, 8, 10]; // Each value doubled
    for (let i = 0; i < expected.length; i++) {
      seqNext(vm.heap, vm, mappedSeq);
      const value = vm.pop();
      expect(value).toEqual(expected[i]);
    }

    seqNext(vm.heap, vm, mappedSeq);
    expect(vm.pop()).toEqual(NIL);
  });

  xit('should filter a sequence based on a predicate', () => {
    const source = rangeSource(vm.heap, 1, 10, 1);

    // Create another sequence to act as the mask for filtering (even numbers)
    const maskSequence = rangeSource(vm.heap, 0, 9, 2); // Will produce [0, 2, 4, 6, 8]

    const filteredSeq = siftSeq(vm.heap, source, maskSequence);

    // We expect to get values for which the mask has non-zero values (i.e., even indices)
    const expected = [2, 4, 6, 8, 10];
    for (let i = 0; i < expected.length; i++) {
      seqNext(vm.heap, vm, filteredSeq);
      const value = vm.pop();
      expect(value).toEqual(expected[i]);
    }

    seqNext(vm.heap, vm, filteredSeq);
    expect(vm.pop()).toEqual(NIL);
  });

  it('should take only the specified number of elements', () => {
    const source = rangeSource(vm.heap, 1, 10, 1);
    const takeCount = 3;

    const takeSequence = takeSeq(vm.heap, source, takeCount);

    // We expect to get only the first 3 elements
    const expected = [1, 2, 3];
    for (let i = 0; i < expected.length; i++) {
      seqNext(vm.heap, vm, takeSequence);
      const value = vm.pop();
      expect(value).toEqual(expected[i]);
    }

    seqNext(vm.heap, vm, takeSequence);
    expect(vm.pop()).toEqual(NIL);
  });

  it('should drop the specified number of elements', () => {
    const source = rangeSource(vm.heap, 1, 10, 1);
    const dropCount = 3;

    const dropSequence = dropSeq(vm.heap, source, dropCount);

    // We expect to get elements after dropping the first 3
    const expected = [4, 5, 6, 7, 8, 9, 10];
    for (let i = 0; i < expected.length; i++) {
      seqNext(vm.heap, vm, dropSequence);
      const value = vm.pop();
      expect(value).toEqual(expected[i]);
    }

    seqNext(vm.heap, vm, dropSequence);
    expect(vm.pop()).toEqual(NIL);
  });

  xit('should scan (accumulate) values using a function', () => {
    const source = rangeSource(vm.heap, 1, 5, 1);

    // Create a function that adds two values
    parse(new Tokenizer('+'));
    const addFunc = toTaggedValue(vm.compiler.BP, false, CoreTag.CODE);

    const initialValue = 0;
    const scanSequence = scanSeq(vm.heap, source, addFunc, initialValue);

    // For a running sum, we expect: [1, 3, 6, 10, 15]
    // Initial: 0
    // 0+1=1, 1+2=3, 3+3=6, 6+4=10, 10+5=15
    const expected = [1, 3, 6, 10, 15];
    for (let i = 0; i < expected.length; i++) {
      seqNext(vm.heap, vm, scanSequence);
      const value = vm.pop();
      expect(value).toEqual(expected[i]);
    }

    seqNext(vm.heap, vm, scanSequence);
    expect(vm.pop()).toEqual(NIL);
  });

  xit('should chain multiple processors together', () => {
    const source = rangeSource(vm.heap, 1, 10, 1);

    // Create a take processor to get first 7 elements
    const takeProcessor = takeSeq(vm.heap, source, 7);

    // Create a drop processor to skip first 2 elements
    const dropProcessor = dropSeq(vm.heap, takeProcessor, 2);

    // Chain them together
    const chainedSeq = chainSeq(vm.heap, source, [takeProcessor, dropProcessor]);

    // We expect elements 3-7 after the operations
    const expected = [3, 4, 5, 6, 7];
    for (let i = 0; i < expected.length; i++) {
      seqNext(vm.heap, vm, chainedSeq);
      const value = vm.pop();
      expect(value).toEqual(expected[i]);
    }

    seqNext(vm.heap, vm, chainedSeq);
    expect(vm.pop()).toEqual(NIL);
  });
});
