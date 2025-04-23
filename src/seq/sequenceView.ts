/**
 * SequenceView provides a high‑level interface over the raw vector
 * that backs every sequence.  It hides the fixed‐header layout
 * [ type, cursor, metaCount, ...metaSlots ] and exposes:
 *  • type        – the SeqSourceType enum value
 *  • metaCount   – how many metadata slots follow
 *  • meta(i)     – read the i’th metadata value
 *  • cursor      – a mutable index/state field for iteration
 *  • next(vm,seq)– advance a child sequence via seqNext
 */

import type { Heap } from '../heap/heap';
import { vectorSimpleGet, vectorSimpleSet } from '../heap/vector';
import { seqNext } from './sequence';
import type { VM } from '../core/vm';

const OFS_TYPE       = 0; // sequence type tag
const OFS_CURSOR     = 1; // per‑sequence cursor/state
const OFS_META_COUNT = 2; // number of meta slots
const OFS_META_START = 3; // first meta slot

export class SequenceView {
  constructor(private heap: Heap, private ptr: number) {}

  /** The sequence’s type (one of SeqSourceType). */
  get type(): number {
    return vectorSimpleGet(this.heap, this.ptr, OFS_TYPE);
  }

  /** How many metadata slots this sequence has. */
  get metaCount(): number {
    return vectorSimpleGet(this.heap, this.ptr, OFS_META_COUNT);
  }

  /**
   * Read the i’th metadata slot (0 ≤ i < metaCount).
   * Returns a tagged value (child sequence ptr, function ptr, etc.).
   */
  meta(i: number): number {
    return vectorSimpleGet(this.heap, this.ptr, OFS_META_START + i);
  }

  /**
   * For processor‐type sequences, the operation code is stored in meta[0].
   */
  get processorType(): number {
    return this.meta(0);
  }

  /**
   * The current cursor/state field for iteration.
   * Used by RANGE, VECTOR, STRING, DICT, and some PROCESSOR sequences.
   */
  get cursor(): number {
    return vectorSimpleGet(this.heap, this.ptr, OFS_CURSOR);
  }

  /**
   * Update the cursor/state field for the next iteration.
   * @param v new cursor value
   */
  set cursor(v: number) {
    vectorSimpleSet(this.heap, this.ptr, OFS_CURSOR, v);
  }

  /**
   * Advance a nested sequence once and push its next element.
   * Delegates to seqNext(heap, vm, childSeq).
   *
   * @param vm       VM to push/pop values
   * @param childSeq Tagged sequence pointer to advance
   * @returns the (unchanged) child sequence pointer
   */
  next(vm: VM, childSeq: number): number {
    return seqNext(vm, childSeq);
  }
}
