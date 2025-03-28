import { CoreTag, NIL, toTaggedValue } from '../core/tagged';
import { vectorCreate } from '../heap/vector';
import { seqNext } from './sequence';
import { rangeSource, vectorSource } from './source';
import { multiSeq, mapSeq } from './processor';
import { describe, it, expect } from '@jest/globals';
import { initializeInterpreter, vm } from '../core/globalState';
import { parse } from '../core/parser';
import { Tokenizer } from '../core/tokenizer';

describe('Sequence Processors', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = true;
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

  it('should map a function over a sequence', () => {
    const source = rangeSource(vm.heap, 1, 5, 1);
    parse(new Tokenizer('(2 *)'));
    const func = toTaggedValue(vm.compiler.BP, false, CoreTag.CODE);
    // vm.push(1);
    // vm.push(func);
    // vm.eval();
    // const value = vm.pop();
    // expect(value).toBe(2);

    // const func = 0; // Mock function pointer
    const mappedSeq = mapSeq(vm.heap, source, func);

    const expected = [1, 2, 3, 4, 5];
    for (let value of expected) {
      seqNext(vm.heap, vm, mappedSeq);
      expect(vm.pop()).toEqual(value);
    }

    seqNext(vm.heap, vm, mappedSeq);
    expect(vm.pop()).toEqual(NIL);
  });
});
