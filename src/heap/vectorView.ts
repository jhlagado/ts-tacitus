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
    // bounds check: must be within [0, length)
    if (i < 0 || i >= this.length) {
      throw new Error(`bad block at index ${i}`);
    }

    let block = this.address;
    // jump through overflow blocks
    const fullBlocks = Math.floor(i / ELEMENTS_PER_BLOCK);
    let idxInBlock = i % ELEMENTS_PER_BLOCK;
    for (let b = 0; b < fullBlocks; b++) {
      block = this.heap.getNextBlock(block);
      if (block === INVALID) {
        throw new Error(`bad block at index ${i}`);
      }
    }
    const off = VEC_DATA + idxInBlock * CELL_SIZE;
    return this.heap.memory.readFloat(
      SEG_HEAP,
      this.heap.blockToByteOffset(block) + off
    );
  }
}
