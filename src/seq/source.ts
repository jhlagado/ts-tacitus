// File: seq/source.ts

import { Heap } from "../core/heap";
import { seqCreate, SEQ_TYPE_RANGE, SEQ_TYPE_VECTOR, SEQ_TYPE_STRING } from "./sequence";
import { Tag, NIL, fromTaggedValue } from "../core/tagged-value";
import { Digest } from "../core/digest";
import { VEC_SIZE } from "../data/vector"; // Correct offset for vector length

/**
 * Creates a range sequence.
 * @param heap - The heap instance.
 * @param start - Starting number (inclusive).
 * @param end - Ending number (exclusive).
 * @param step - Step size (default 1).
 * @returns A tagged sequence.
 */
export function seqFromRange(heap: Heap, start: number, end: number, step: number = 1): number {
  const length = Math.ceil((end - start) / step);
  const seqPtr = seqCreate(heap, SEQ_TYPE_RANGE, length);
  if (seqPtr === NIL) return NIL;

  const { value: ptr } = fromTaggedValue(Tag.SEQ, seqPtr);
  heap.memory.writeFloat(ptr + 12, start);
  heap.memory.writeFloat(ptr + 16, step);

  return seqPtr;
}


/**
 * Creates a sequence from an existing vector.
 * @param heap - The heap instance.
 * @param vectorPtr - A tagged vector pointer.
 * @returns A tagged sequence.
 */
export function seqFromVector(heap: Heap, vectorPtr: number): number {
  const { value: vecPtr } = fromTaggedValue(Tag.BLOCK, vectorPtr);

  // Read the vector length correctly
  const length = heap.memory.read16(vecPtr + VEC_SIZE);

  const seqPtr = seqCreate(heap, SEQ_TYPE_VECTOR, length);
  if (seqPtr === NIL) return NIL;

  const { value: ptr } = fromTaggedValue(Tag.SEQ, seqPtr);
  heap.memory.writeFloat(ptr + 12, vecPtr); // Store reference to the vector

  return seqPtr;
}

/**
 * Creates a sequence that iterates over characters in a string.
 * @param digest - The digest instance used for interning the string.
 * @param heap - The heap instance.
 * @param str - The string to iterate over.
 * @returns A tagged sequence.
 */
export function seqFromString(digest: Digest, heap: Heap, str: string): number {
  const length = str.length;
  if (length === 0) return NIL;

  // Intern the string in Digest and store the reference
  const strPtr = digest.intern(str);

  const seqPtr = seqCreate(heap, SEQ_TYPE_STRING, length);
  if (seqPtr === NIL) return NIL;

  const { value: ptr } = fromTaggedValue(Tag.SEQ, seqPtr);
  heap.memory.writeFloat(ptr + 12, strPtr); // Store interned string pointer

  return seqPtr;
}
