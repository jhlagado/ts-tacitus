// File: src/sequence.ts

import { Heap } from "../data/heap";
import { viewGet } from "../data/view";
// Also include the base functions for source sequences.

// Base sequence functions for source sequences.
// These are the ones used by seqFromView and also by processors to retrieve elements.
import {
  UNDEF,
  Tag,
  toTaggedValue,
  fromTaggedValue,
  isTaggedValue,
  getTag,
} from "../tagged-value";

/**
 * seqNext consumes the next element from a source sequence.
 * It is assumed that the sequence block layout is:
 *   Offset 4: underlying view pointer,
 *   Offset 6: current index,
 *   Offset 8: total number of elements,
 *   Offset 10: step size (currently always 1).
 */
export function seqNext(heap: Heap, seqPtr: number): number {
  if (!isTaggedValue(seqPtr) || getTag(seqPtr) !== Tag.SEQ) return UNDEF;

  const { value: seqBlock } = fromTaggedValue(Tag.SEQ, seqPtr);
  let index = heap.memory.read16(seqBlock + 6); // current index
  const total = heap.memory.read16(seqBlock + 8); // total number of elements

  if (index >= total) return UNDEF;

  // Retrieve the underlying view pointer.
  const viewBlock = heap.memory.read16(seqBlock + 4);
  const viewPtr = toTaggedValue(Tag.VIEW, viewBlock);
  const element = viewGet(heap, viewPtr, [index]);

  // Increment the sequence's index.
  heap.memory.write16(seqBlock + 6, index + 1);

  return element;
}

/**
 * seqDup duplicates a sequence block, for use in copy-on-write semantics.
 */
export function seqDup(heap: Heap, seqPtr: number): number {
  if (!isTaggedValue(seqPtr)) {
    return UNDEF; // Handle non-tagged values safely
  }
  const seqBlock = fromTaggedValue(Tag.SEQ, seqPtr).value;
  const newBlock = heap.cloneBlock(seqBlock);
  if (newBlock === UNDEF) return UNDEF;
  return toTaggedValue(Tag.SEQ, newBlock);
}
