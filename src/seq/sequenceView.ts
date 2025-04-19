import type { Heap } from '../heap/heap';
import { SEG_HEAP } from '../core/memory';
import { VEC_DATA } from '../heap/vector';

const OFF_TYPE       = 0;  // headerData[0]
const OFF_META_COUNT = 1;  // headerData[1]
const OFF_META_START = 2;  // headerData[2..]
const CELL_SIZE      = 4;  // bytes per tagged float

export class SequenceView {
  constructor(private heap: Heap, private address: number) {}

  private base(): number {
    // skip the vector’s own header
    return this.heap.blockToByteOffset(this.address) + VEC_DATA;
  }

  get type(): number {
    return this.heap.memory.readFloat(SEG_HEAP, this.base() + OFF_TYPE * CELL_SIZE);
  }

  get metaCount(): number {
    return this.heap.memory.readFloat(SEG_HEAP, this.base() + OFF_META_COUNT * CELL_SIZE);
  }

  meta(n: number): number {
    return this.heap.memory.readFloat(
      SEG_HEAP,
      this.base() + (OFF_META_START + n) * CELL_SIZE
    );
  }

  // for processor sequences:
  get processorType(): number {
    return this.meta(0);
  }
}
