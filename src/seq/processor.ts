// File: src/processor.ts

import { Heap } from "../data/heap";
import {
  UNDEF,
  Tag,
  toTaggedValue,
  fromTaggedValue,
  getTag,
  isTaggedValue,
} from "../tagged-value";
import { seqNext } from "./sequence";

// We will allocate a processor sequence block with this simple layout:
// Offset 4: underlying source sequence pointer (2 bytes)
// Offset 6: processor type (2 bytes) — 1 for map, 2 for filter.
// (No extra fields for now. For scan, you might add an accumulator at offset 8.)
// We store the processor function in a global dictionary keyed by the block pointer.
export const PROC_SEQ_SOURCE = 4;
export const PROC_SEQ_TYPE = 6;

// Processor type constants.
export const PROC_TYPE_MAP = 1;
export const PROC_TYPE_FILTER = 2;

// Global object to store processor operations (function pointers).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const processorOps: { [key: number]: any } = {};

/**
 * Create a processor sequence that applies a mapping function to each element.
 */
export function seqMap(
  heap: Heap,
  sourceSeq: number,
  op: (x: number) => number
): number {
  if (!isTaggedValue(sourceSeq) || getTag(sourceSeq) !== Tag.SEQ) return UNDEF;

  // Allocate a new block for the processor sequence.
  const procBlock = heap.malloc(64);
  if (procBlock === UNDEF) return UNDEF;

  // Store the underlying source sequence block pointer.
  const { value: srcBlock } = fromTaggedValue(Tag.SEQ, sourceSeq);
  heap.memory.write16(procBlock + PROC_SEQ_SOURCE, srcBlock);
  // Set processor type to map.
  heap.memory.write16(procBlock + PROC_SEQ_TYPE, PROC_TYPE_MAP);

  // Save the mapping function in the global dictionary.
  processorOps[procBlock] = { op };

  return toTaggedValue(Tag.SEQ, procBlock);
}

/**
 * Create a processor sequence that filters elements using a predicate.
 */
export function seqFilter(
  heap: Heap,
  sourceSeq: number,
  pred: (x: number) => boolean
): number {
  if (!isTaggedValue(sourceSeq) || getTag(sourceSeq) !== Tag.SEQ) return UNDEF;

  const procBlock = heap.malloc(64);
  if (procBlock === UNDEF) return UNDEF;

  const { value: srcBlock } = fromTaggedValue(Tag.SEQ, sourceSeq);
  heap.memory.write16(procBlock + PROC_SEQ_SOURCE, srcBlock);
  heap.memory.write16(procBlock + PROC_SEQ_TYPE, PROC_TYPE_FILTER);

  processorOps[procBlock] = { pred };

  return toTaggedValue(Tag.SEQ, procBlock);
}

/**
 * seqNextProcessor: Given a processor sequence (map or filter), produce the next element.
 * For map, it applies the op function to the next element of the source sequence.
 * For filter, it repeatedly retrieves the next element until one satisfies the predicate.
 */
export function seqNextProcessor(heap: Heap, procSeq: number): number {
  if (!isTaggedValue(procSeq) || getTag(procSeq) !== Tag.SEQ) return UNDEF;

  const { value: procBlock } = fromTaggedValue(Tag.SEQ, procSeq);
  const type = heap.memory.read16(procBlock + PROC_SEQ_TYPE);
  const srcBlock = heap.memory.read16(procBlock + PROC_SEQ_SOURCE);
  // Wrap the underlying source sequence pointer back into a tagged value.
  const sourceSeqPtr = toTaggedValue(Tag.SEQ, srcBlock);

  if (type === PROC_TYPE_MAP) {
    const element = seqNext(heap, sourceSeqPtr);
    if (element === UNDEF) return UNDEF;
    const { op } = processorOps[procBlock];
    return op(element);
  } else if (type === PROC_TYPE_FILTER) {
    const { pred } = processorOps[procBlock];
    while (true) {
      const element = seqNext(heap, sourceSeqPtr);
      if ((element)===UNDEF) return UNDEF;
      if (pred(element)) return element;
    }
  }
  return UNDEF;
}
