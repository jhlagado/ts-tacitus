import { NIL } from '../core/tagged';
import { vectorCreate } from '../heap/vector';
import { seqNext } from './sequence';
import { rangeSource, vectorSource } from './source';
import { multiSeq, takeSeq, dropSeq } from './processor';
import { initializeInterpreter, vm } from '../core/globalState';

describe('Sequence Processors', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  xit('should process multiple sequences in parallel', () => {
    const seq1 = rangeSource(vm.heap, 1, 3, 1);
    const seq2 = vectorSource(vm.heap, vectorCreate(vm.heap, [100, 200, 300]));
    const multiSeqResult = multiSeq(vm.heap, [seq1, seq2]);

    const expected = [
      [1, 100],
      [2, 200],
      [3, 300],
    ];

    for (let row of expected) {
      seqNext(vm, multiSeqResult);
      const v1 = vm.pop();
      const v2 = vm.pop();
      expect(v1).toBe(row[1]);
      expect(v2).toBe(row[0]);
    }

    seqNext(vm, multiSeqResult);
    expect(vm.pop()).toEqual(NIL);
  });

  xit('should take only the specified number of elements', () => {
    const source = rangeSource(vm.heap, 1, 10, 1);
    const takeCount = 3;

    const takeSequence = takeSeq(vm.heap, source, takeCount);

    // We expect to get only the first 3 elements
    const expected = [1, 2, 3];
    for (let i = 0; i < expected.length; i++) {
      seqNext(vm, takeSequence);
      const value = vm.pop();
      expect(value).toEqual(expected[i]);
    }

    seqNext(vm, takeSequence);
    expect(vm.pop()).toEqual(NIL);
  });

  it('should drop the specified number of elements', () => {
    const source = rangeSource(vm.heap, 1, 10, 1);
    const dropCount = 3;

    const dropSequence = dropSeq(vm.heap, source, dropCount);

    // We expect to get elements after dropping the first 3
    const expected = [4, 5, 6, 7, 8, 9, 10];
    for (let i = 0; i < expected.length; i++) {
      console.log('-----------------------------1');
      seqNext(vm, dropSequence);
      const value = vm.pop();
      expect(value).toEqual(expected[i]);
    }

    seqNext(vm, dropSequence);
    expect(vm.pop()).toEqual(NIL);
  });
});
