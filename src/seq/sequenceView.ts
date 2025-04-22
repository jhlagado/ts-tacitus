import type { Heap } from '../heap/heap';
import { vectorSimpleGet, vectorSimpleSet } from '../heap/vector';
import { seqNext } from './sequence';
import type { VM } from '../core/vm';

const OFF_TYPE = 0; // headerData[0]
const OFF_META_COUNT = 1; // headerData[1]
const OFF_META_START = 2; // headerData[2..]

export class SequenceView {
  constructor(private heap: Heap, private ptr: number) {}

  get type(): number {
    return vectorSimpleGet(this.heap, this.ptr, OFF_TYPE);
  }

  get metaCount(): number {
    return vectorSimpleGet(this.heap, this.ptr, OFF_META_COUNT);
  }

  meta(n: number): number {
    return vectorSimpleGet(this.heap, this.ptr, OFF_META_START + n);
  }

  // for processor sequences:
  get processorType(): number {
    return this.meta(0);
  }

  public next(vm: VM, childSeq: number): number {
    return seqNext(this.heap, vm, childSeq);
  }

  /** read the per‐sequence cursor (after all meta slots) */
  public get cursor(): number {
    return vectorSimpleGet(this.heap, this.ptr, OFF_META_START + this.metaCount);
  }

  /** write the per‐sequence cursor */
  public set cursor(value: number) {
    vectorSimpleSet(this.heap, this.ptr, OFF_META_START + this.metaCount, value);
  }
}
