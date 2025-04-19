import type { Heap } from './heap';
import { BLOCK_SIZE } from './heap';
import { SEG_HEAP } from '../core/memory';
import { VEC_SIZE, VEC_DATA } from './vector';
import { CELL_SIZE, INVALID } from '../core/constants';

// how many elements fit per block payload?
const ELEMENTS_PER_BLOCK = Math.floor((BLOCK_SIZE - VEC_DATA) / CELL_SIZE);

/**
 * Provides an easy way to iterate a heap‐vector’s elements
 * without manually computing block+offset arithmetic.
 */
export class VectorView {
  constructor(private heap: Heap, private address: number) {}

  /** Number of elements in the vector */
  get length(): number {
    return this.heap.memory.read16(
      SEG_HEAP,
      this.heap.blockToByteOffset(this.address) + VEC_SIZE
    );
  }

  /**
   * read the element at index i
   * (automatically walks to the correct block if i >= ELEMENTS_PER_BLOCK)
   */
  element(i: number): number {
    let block = this.address;
    // jump through overflow blocks
    const fullBlocks = Math.floor(i / ELEMENTS_PER_BLOCK);
    let idxInBlock = i % ELEMENTS_PER_BLOCK;
    for (let b = 0; b < fullBlocks; b++) {
      block = this.heap.getNextBlock(block);
      if (block === INVALID) throw new Error(`VectorView: bad block at index ${i}`);
    }
    const off = VEC_DATA + idxInBlock * CELL_SIZE;
    return this.heap.memory.readFloat(
      SEG_HEAP,
      this.heap.blockToByteOffset(block) + off
    );
  }

  /** Yields each 32‑bit float (tagged value) in order */
  *elements(): Iterable<number> {
    let block = this.address;
    let offset = VEC_DATA;
    for (let i = 0; i < this.length; i++) {
      if (offset + 4 > BLOCK_SIZE) {
        block = this.heap.getNextBlock(block);
        if (block === INVALID) return;
        offset = VEC_DATA;
      }
      const el = this.heap.memory.readFloat(
        SEG_HEAP,
        this.heap.blockToByteOffset(block) + offset
      );
      yield el;
      offset += 4;
    }
  }
}
