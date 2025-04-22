import type { Heap } from '../heap/heap';
import { vectorSimpleGet, vectorSimpleSet } from '../heap/vector';
import { OFS_CURSOR, OFS_META_COUNT, OFS_META_START, OFS_TYPE, seqNext } from './sequence';
import type { VM } from '../core/vm';

export class SequenceView {
  constructor(private heap: Heap, private ptr: number) {}

  get type(): number {
    return vectorSimpleGet(this.heap, this.ptr, OFS_TYPE);
  }

  /** read the per‐sequence cursor (after all meta slots) */
  public get cursor(): number {
    return vectorSimpleGet(this.heap, this.ptr, OFS_CURSOR);
  }

  /** write the per‐sequence cursor */
  public set cursor(value: number) {
    vectorSimpleSet(this.heap, this.ptr, OFS_CURSOR, value);
  }

  get metaCount(): number {
    return vectorSimpleGet(this.heap, this.ptr, OFS_META_COUNT);
  }

  meta(n: number): number {
    return vectorSimpleGet(this.heap, this.ptr, OFS_META_START + n);
  }

  // for processor sequences:
  get processorType(): number {
    return this.meta(0);
  }

  public next(vm: VM, childSeq: number): number {
    return seqNext(vm, childSeq);
  }

}
