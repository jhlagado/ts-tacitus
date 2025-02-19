// File: seq/sink.ts

import { Heap } from "../core/heap";
import { seqNext } from "./sequence";
import { vectorCreate } from "../data/vector";
import { NIL } from "../core/tagged-value";
import { Digest } from "../core/digest";

/**
 * Converts a sequence into a vector.
 * Iterates through the sequence and stores the elements in a newly allocated vector.
 *
 * @param digest - The Digest instance (used for strings).
 * @param heap - The memory heap.
 * @param seqPtr - The tagged sequence pointer.
 * @returns A tagged vector containing all elements from the sequence.
 */
export function seqToVector(digest: Digest, heap: Heap, seqPtr: number): number {
  const elements: number[] = [];

  while (true) {
    const nextVal = seqNext(digest, heap, seqPtr);
    if (nextVal === NIL) break;
    elements.push(nextVal);
  }

  return vectorCreate(heap, elements);
}

/**
 * Reduces a sequence to a single value using a left fold.
 * Currently performs identity reduction by taking the last element.
 * Future implementation will accept a function argument for custom reduction.
 *
 * @param digest - The Digest instance.
 * @param heap - The memory heap.
 * @param seqPtr - The tagged sequence pointer.
 * @returns The reduced value (last element), or NIL if empty.
 */
export function seqReduce(digest: Digest, heap: Heap, seqPtr: number): number {
  let lastValue = NIL;

  while (true) {
    const nextVal = seqNext(digest, heap, seqPtr);
    if (nextVal === NIL) break;
    lastValue = nextVal; // Keep the last element
  }

  return lastValue;
}

/**
 * Iterates through a sequence, performing a side effect on each element.
 * Currently just iterates through all elements (identity behavior).
 *
 * @param digest - The Digest instance.
 * @param heap - The memory heap.
 * @param seqPtr - The tagged sequence pointer.
 */
export function seqForEach(digest: Digest, heap: Heap, seqPtr: number): void {
  while (true) {
    const nextVal = seqNext(digest, heap, seqPtr);
    if (nextVal === NIL) break;
    // Side effect placeholder (e.g., console.log for debugging)
  }
}
