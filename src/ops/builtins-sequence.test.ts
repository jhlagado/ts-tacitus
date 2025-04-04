/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  rangeOp,
  seqOp,
  mapOp,
  siftOp,
  filterOp,
  seqTakeOp,
  seqDropOp,
  toVectorOp,
  countOp,
  lastOp,
  reduceOp,
} from './builtins-sequence';
import * as tagged from '../core/tagged';
import { HeapTag, CoreTag } from '../core/tagged';

// Override fromTaggedValue to be an identity function.
(tagged as any).fromTaggedValue = (ptr: any) => ptr;

// Updated stub assignments with explicit types.
import * as source from '../seq/source';
import * as processor from '../seq/processor';
import * as sink from '../seq/sink';

// Cast modules to any to override read-only properties.
(source as any).rangeSource = (_heap: any, start: number, end: number, step: number): number =>
  start + end + step;
(source as any).vectorSource = (_heap: any, _sourcePtr: any): number => 100;
(source as any).dictionarySource = (_heap: any, _sourcePtr: any): number => 200;
(source as any).stringSource = (_heap: any, _sourcePtr: any): number => 300;
(source as any).constantSource = (_heap: any, _sourcePtr: any): number => 400;

(processor as any).mapSeq = (_heap: any, _sourceSeq: any, _func: any): number => 500;
(processor as any).siftSeq = (_heap: any, _sourceSeq: any, _maskSeq: any): number => 600;
(processor as any).filterSeq = (_heap: any, _sourceSeq: any, _predicateFunc: any): number => 700;
(processor as any).takeSeq = (_heap: any, _sourceSeq: any, _count: number): number => 800;
(processor as any).dropSeq = (_heap: any, _sourceSeq: any, _count: number): number => 900;

(sink as any).toVector = (_heap: any, _vm: any, _seq: any): number => 1000;
(sink as any).count = (_heap: any, _vm: any, _seq: any): number => 42;
(sink as any).last = (_heap: any, _vm: any, _seq: any): number => 999;
(sink as any).forEach = (_heap: any, _vm: any, seq: any, callback: (val: any) => void): void => {
  if (Array.isArray(seq)) {
    seq.forEach((val: any) => callback(val));
  }
};
(sink as any).reduce = (
  _heap: any,
  _vm: any,
  seq: any,
  func: (acc: any, val: any) => any,
  initial: any,
  _evalFn: () => void
): any => (Array.isArray(seq) ? seq.reduce((acc, val) => func(acc, val), initial) : initial);

// Minimal MockVM with explicit return types.
class MockVM {
  public stack: any[] = [];
  public heap: any = {};
  pop(): any {
    return this.stack.pop();
  }
  push(val: any): void {
    this.stack.push(val);
  }
  eval(): void {
    // dummy eval; does nothing.
  }
}

describe('builtins-sequence operations', () => {
  // For tests expecting a full VM, cast our MockVM as any.
  describe('rangeOp', () => {
    test('should push computed range value', () => {
      const vm = new MockVM();
      vm.push(10); // start
      vm.push(20); // end
      vm.push(2); // step
      rangeOp(vm as any);
      expect(vm.pop()).toBe(32);
    });
  });

  describe('seqOp', () => {
    test('should return the same pointer if tag is SEQ', () => {
      const vm = new MockVM();
      const seqPtr = { tag: HeapTag.SEQ, heap: true, id: 1 };
      vm.push(seqPtr);
      seqOp(vm as any);
      expect(vm.pop()).toBe(seqPtr);
    });

    test('should process vector when tag is VECTOR', () => {
      const vm = new MockVM();
      const vectorPtr = { tag: HeapTag.VECTOR, heap: true, id: 2 };
      vm.push(vectorPtr);
      seqOp(vm as any);
      expect(vm.pop()).toBe(100);
    });

    test('should process dictionary when tag is DICT', () => {
      const vm = new MockVM();
      const dictPtr = { tag: HeapTag.DICT, heap: true, id: 3 };
      vm.push(dictPtr);
      seqOp(vm as any);
      expect(vm.pop()).toBe(200);
    });

    test('should process string when tag is STRING and not heap', () => {
      const vm = new MockVM();
      const strPtr = { tag: CoreTag.STRING, heap: false, id: 4 };
      vm.push(strPtr);
      seqOp(vm as any);
      expect(vm.pop()).toBe(300);
    });

    test('should process number when tag is INTEGER and not heap', () => {
      const vm = new MockVM();
      const numPtr = { tag: CoreTag.INTEGER, heap: false, id: 5 };
      vm.push(numPtr);
      seqOp(vm as any);
      expect(vm.pop()).toBe(400);
    });

    test('should throw error for invalid types', () => {
      const vm = new MockVM();
      const badPtr = { tag: 'BAD', heap: false, id: 6 };
      vm.push(badPtr);
      expect(() => seqOp(vm as any)).toThrow();
    });
  });

  describe('mapOp', () => {
    test('should push dummy map sequence', () => {
      const vm = new MockVM();
      vm.push(999); // dummy func
      vm.push(111); // dummy source sequence
      mapOp(vm as any);
      expect(vm.pop()).toBe(500);
    });
  });

  describe('siftOp', () => {
    test('should push dummy sift sequence', () => {
      const vm = new MockVM();
      vm.push(222);
      vm.push(333);
      siftOp(vm as any);
      expect(vm.pop()).toBe(600);
    });
  });

  describe('filterOp', () => {
    test('should push dummy filter sequence', () => {
      const vm = new MockVM();
      vm.push(444);
      vm.push(555);
      filterOp(vm as any);
      expect(vm.pop()).toBe(700);
    });
  });

  describe('seqTakeOp', () => {
    test('should push dummy take sequence', () => {
      const vm = new MockVM();
      vm.push(3);
      vm.push(666);
      seqTakeOp(vm as any);
      expect(vm.pop()).toBe(800);
    });
  });

  describe('seqDropOp', () => {
    test('should push dummy drop sequence', () => {
      const vm = new MockVM();
      vm.push(2);
      vm.push(777);
      seqDropOp(vm as any);
      expect(vm.pop()).toBe(900);
    });
  });

  describe('toVectorOp', () => {
    test('should push dummy vector', () => {
      const vm = new MockVM();
      vm.push(888);
      toVectorOp(vm as any);
      expect(vm.pop()).toBe(1000);
    });
  });

  describe('countOp', () => {
    test('should push dummy count', () => {
      const vm = new MockVM();
      vm.push(999);
      countOp(vm as any);
      expect(vm.pop()).toBe(42);
    });
  });

  describe('lastOp', () => {
    test('should push dummy last element', () => {
      const vm = new MockVM();
      vm.push(1010);
      lastOp(vm as any);
      expect(vm.pop()).toBe(999);
    });
  });

  describe('reduceOp', () => {
    test('should reduce an array correctly', () => {
      const vm = new MockVM();
      const seq = [1, 2, 3, 4];
      const sumFunc = (acc: number, curr: number) => acc + curr;
      vm.push(seq);
      vm.push(0);
      vm.push(sumFunc);
      reduceOp(vm as any);
      expect(vm.pop()).toBe(10);
    });
  });
});
