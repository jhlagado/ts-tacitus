import { NIL } from '../core/tagged';
import { seqNext } from './sequence';
import { rangeSource } from './source';
import { takeSeq, dropSeq } from './processor';
import { initializeInterpreter, vm } from '../core/globalState';

describe('Sequence Processors', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  it('should take only the specified number of elements', () => {
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
      seqNext(vm, dropSequence);
      const value = vm.pop();
      expect(value).toEqual(expected[i]);
    }

    seqNext(vm, dropSequence);
    expect(vm.pop()).toEqual(NIL);
  });
});
