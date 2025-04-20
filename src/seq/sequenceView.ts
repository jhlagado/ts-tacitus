import type { Heap } from '../heap/heap';
import { SEG_HEAP } from '../core/memory';
import { VEC_DATA } from '../heap/vector';
import { seqNext } from './sequence';
import type { VM } from '../core/vm';
import { CELL_SIZE } from '../core/constants';
// removed external SEQ_CURSOR_OFFSET import

const OFF_TYPE = 0; // headerData[0]
const OFF_META_COUNT = 1; // headerData[1]
const OFF_META_START = 2; // headerData[2..]

export class SequenceView {
  constructor(private heap: Heap, private address: number) {}

  private base(): number {
    return this.heap.blockToByteOffset(this.address) + VEC_DATA;
  }

  get type(): number {
    return this.heap.memory.readFloat(SEG_HEAP, this.base() + OFF_TYPE * CELL_SIZE);
  }

  get metaCount(): number {
    return this.heap.memory.readFloat(SEG_HEAP, this.base() + OFF_META_COUNT * CELL_SIZE);
  }

  meta(n: number): number {
    return this.heap.memory.readFloat(SEG_HEAP, this.base() + (OFF_META_START + n) * CELL_SIZE);
  }

  // for processor sequences:
  get processorType(): number {
    return this.meta(0);
  }

  /**
   * Advance a child‐sequence once and return its result
   */
  public next(vm: VM, childSeq: number): number {
    return seqNext(this.heap, vm, childSeq);
  }

  /** read the per‐sequence cursor (after all meta slots) */
  public get cursor(): number {
    const byteOff = this.base() + (OFF_META_START + this.metaCount) * CELL_SIZE;
    return this.heap.memory.readFloat(SEG_HEAP, byteOff);
  }

  /** write the per‐sequence cursor */
  public set cursor(value: number) {
    const byteOff = this.base() + (OFF_META_START + this.metaCount) * CELL_SIZE;
    this.heap.memory.writeFloat(SEG_HEAP, byteOff, value);
  }
}
