// File: seq/processor.ts

import { Heap } from "../core/heap";
import { seqCreate, SEQ_TYPE_MAP, SEQ_TYPE_FILTER, SEQ_TYPE_ZIP, SEQ_EXTRA, SEQ_LEN, SEQ_META } from "./sequence";
import { fromTaggedValue, Tag, NIL } from "../core/tagged-value";

/**
 * Creates a mapped sequence (currently passes values through).
 * @param heap - The heap instance.
 * @param sourceSeq - A tagged sequence pointer.
 * @returns A tagged sequence pointer.
 */
export function seqMap(heap: Heap, sourceSeq: number): number {
  const { value: srcPtr } = fromTaggedValue(Tag.SEQ, sourceSeq);
  const length = heap.memory.readFloat(srcPtr + SEQ_LEN);

  const seqPtr = seqCreate(heap, SEQ_TYPE_MAP, length);
  if (seqPtr === NIL) return NIL;

  const { value: ptr } = fromTaggedValue(Tag.SEQ, seqPtr);
  heap.memory.writeFloat(ptr + SEQ_META, sourceSeq);

  return seqPtr;
}

/**
 * Creates a filtered sequence (currently does not filter).
 * @param heap - The heap instance.
 * @param sourceSeq - A tagged sequence pointer.
 * @returns A tagged sequence pointer.
 */
export function seqFilter(heap: Heap, sourceSeq: number): number {
  const { value: srcPtr } = fromTaggedValue(Tag.SEQ, sourceSeq);
  const length = heap.memory.readFloat(srcPtr + SEQ_LEN);

  const seqPtr = seqCreate(heap, SEQ_TYPE_FILTER, length);
  if (seqPtr === NIL) return NIL;

  const { value: ptr } = fromTaggedValue(Tag.SEQ, seqPtr);
  heap.memory.writeFloat(ptr + SEQ_META, sourceSeq);

  return seqPtr;
}

/**
 * Creates a zipped sequence that combines two sequences into pairs.
 */
export function seqZip(heap: Heap, seqA: number, seqB: number): number {
  const { value: ptrA } = fromTaggedValue(Tag.SEQ, seqA);
  const { value: ptrB } = fromTaggedValue(Tag.SEQ, seqB);
  const lenA = heap.memory.readFloat(ptrA + SEQ_LEN);
  const lenB = heap.memory.readFloat(ptrB + SEQ_LEN);
  const length = Math.min(lenA, lenB);

  const seqPtr = seqCreate(heap, SEQ_TYPE_ZIP, length);
  if (seqPtr === NIL) return NIL;

  const { value: ptr } = fromTaggedValue(Tag.SEQ, seqPtr);
  heap.memory.writeFloat(ptr + SEQ_META, seqA);
  heap.memory.writeFloat(ptr + SEQ_EXTRA, seqB);

  return seqPtr;
}
