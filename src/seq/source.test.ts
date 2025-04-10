import {
  rangeSource,
  vectorSource,
  stringSource,
  constantSource,
  dictionarySource,
} from './source';
import { Heap } from '../heap/heap';
import {
  SEQ_SRC_CONSTANT,
  SEQ_SRC_DICT,
  SEQ_SRC_RANGE,
  SEQ_SRC_STRING,
  SEQ_SRC_VECTOR,
  seqCreate,
} from './sequence';
import { initializeInterpreter, vm } from '../core/globalState';
import { VM } from '../core/vm';

jest.mock('./sequence', () => ({
  seqCreate: jest.fn(),
}));

describe('source.ts', () => {
  let testVM: VM;
  let heap: Heap;

  beforeEach(() => {
    initializeInterpreter();
    testVM = vm;
    heap = testVM.heap;
    testVM.debug = false;
    jest.clearAllMocks();
  });

  describe('rangeSource', () => {
    it('should create a range sequence', () => {
      rangeSource(heap, 1, 10, 2);
      expect(seqCreate).toHaveBeenCalledWith(heap, SEQ_SRC_RANGE, [1, 2, 10]);
    });
  });

  describe('vectorSource', () => {
    it('should create a vector sequence', () => {
      vectorSource(heap, 123);
      expect(seqCreate).toHaveBeenCalledWith(heap, SEQ_SRC_VECTOR, [123]);
    });
  });

  describe('stringSource', () => {
    it('should create a string sequence', () => {
      stringSource(heap, 456);
      expect(seqCreate).toHaveBeenCalledWith(heap, SEQ_SRC_STRING, [456]);
    });
  });

  describe('constantSource', () => {
    it('should create a constant sequence', () => {
      constantSource(heap, 789);
      expect(seqCreate).toHaveBeenCalledWith(heap, SEQ_SRC_CONSTANT, [789]);
    });
  });

  describe('dictionarySource', () => {
    it('should create a dictionary sequence', () => {
      dictionarySource(heap, 321);
      expect(seqCreate).toHaveBeenCalledWith(heap, SEQ_SRC_DICT, [321, 0]);
    });
  });
});
