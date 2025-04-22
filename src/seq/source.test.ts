import { initializeInterpreter, vm } from '../core/globalState';
import * as seqModule from './sequence';
import {
  rangeSource,
  vectorSource,
  stringSource,
  constantSource,
  dictionarySource,
} from './source';

describe('source.ts', () => {
  let seqCreateSpy: jest.SpyInstance;

  beforeEach(() => {
    initializeInterpreter();
    // spy ONLY on seqCreate, leave SeqSourceType intact
    seqCreateSpy = jest.spyOn(seqModule, 'seqCreate').mockImplementation(jest.fn());
  });

  afterEach(() => {
    seqCreateSpy.mockRestore();
  });

  it('rangeSource calls seqCreate with RANGE', () => {
    rangeSource(vm.heap, 1, 10, 2);
    expect(seqCreateSpy).toHaveBeenCalledWith(
      expect.anything(),
      seqModule.SeqSourceType.RANGE,
      [1, 2, 10]
    );
  });

  it('vectorSource calls seqCreate with VECTOR', () => {
    vectorSource(vm.heap, 123);
    expect(seqCreateSpy).toHaveBeenCalledWith(expect.anything(), seqModule.SeqSourceType.VECTOR, [
      123,
    ]);
  });

  it('stringSource calls seqCreate with STRING', () => {
    stringSource(vm.heap, 456);
    expect(seqCreateSpy).toHaveBeenCalledWith(expect.anything(), seqModule.SeqSourceType.STRING, [
      456,
    ]);
  });

  it('constantSource calls seqCreate with CONSTANT', () => {
    constantSource(vm.heap, 789);
    expect(seqCreateSpy).toHaveBeenCalledWith(expect.anything(), seqModule.SeqSourceType.CONSTANT, [
      789,
    ]);
  });

  it('dictionarySource calls seqCreate with DICT', () => {
    dictionarySource(vm.heap, 321);
    expect(seqCreateSpy).toHaveBeenCalledWith(
      expect.anything(),
      seqModule.SeqSourceType.DICT,
      [321, 0]
    );
  });
});
