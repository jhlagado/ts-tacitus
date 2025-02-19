// File: seq/sequence.ts

import { Heap } from "../core/heap";
import { Tag, toTaggedValue, fromTaggedValue, NIL } from "../core/tagged-value";
import { vectorCreate, vectorGet, vectorUpdate } from "../data/vector";
import { Digest } from "../core/digest";

// Sequence memory layout (same as vector but tagged as SEQ)
export const SEQ_LEN = 0;      // Number of elements (-1 if unknown)
export const SEQ_TYPE = 4;     // Type identifier (range, vector, string, etc.)
export const SEQ_POS = 8;      // Current index
export const SEQ_META = 12;    // Extra metadata (vector, function pointers, etc.)
export const SEQ_EXTRA = 16;   // Extra space (step size, additional sequence pointers)

// Sequence type constants
export const SEQ_TYPE_RANGE = 1;
export const SEQ_TYPE_VECTOR = 2;
export const SEQ_TYPE_STRING = 3;
export const SEQ_TYPE_MAP = 4;
export const SEQ_TYPE_FILTER = 5;
export const SEQ_TYPE_ZIP = 6;

/**
 * Creates a sequence, storing it as a vector first.
 * @param heap - The memory heap.
 * @param type - The sequence type identifier.
 * @param length - Number of elements (-1 if unknown).
 * @returns A tagged pointer to the sequence.
 */
export function seqCreate(heap: Heap, type: number, length: number): number {
  // Allocate using vectorCreate, ensuring we reserve enough metadata space
  const vecPtr = vectorCreate(heap, new Array(4).fill(0)); // Allocate metadata
  if (vecPtr === NIL) return NIL;

  // Re-tag the pointer as SEQ instead of BLOCK
  const { value: ptr } = fromTaggedValue(Tag.BLOCK, vecPtr);
  heap.memory.writeFloat(ptr + SEQ_LEN, length);
  heap.memory.writeFloat(ptr + SEQ_TYPE, type);
  heap.memory.writeFloat(ptr + SEQ_POS, 0);

  return toTaggedValue(Tag.SEQ, ptr);
}

/**
 * Advances the sequence and retrieves the next value.
 * @param digest - The Digest instance (used for strings).
 * @param heap - The heap where the sequence is stored.
 * @param seqPtr - The tagged sequence pointer.
 * @returns The next value, or NIL if exhausted.
 */
export function seqNext(digest: Digest, heap: Heap, seqPtr: number): number {
  const { value: ptr } = fromTaggedValue(Tag.SEQ, seqPtr);
  const type = heap.memory.readFloat(ptr + SEQ_TYPE);
  const pos = heap.memory.readFloat(ptr + SEQ_POS);
  const length = heap.memory.readFloat(ptr + SEQ_LEN);

  if (length !== -1 && pos >= length) return NIL;

  let result = NIL;

  switch (type) {
    case SEQ_TYPE_RANGE: { // Range sequence
      const start = heap.memory.readFloat(ptr + SEQ_META);
      const step = heap.memory.readFloat(ptr + SEQ_EXTRA);
      result = start + pos * step;
      break;
    }

    case SEQ_TYPE_VECTOR: { // Vector sequence
      const vecPtr = heap.memory.readFloat(ptr + SEQ_META);
      result = vectorGet(heap, vecPtr, pos);
      break;
    }

    case SEQ_TYPE_STRING: { // String sequence
      const strPtr = heap.memory.readFloat(ptr + SEQ_META);
      const storedStr = digest.get(strPtr);
      result = storedStr.charCodeAt(pos) || NIL;
      break;
    }

    case SEQ_TYPE_MAP: { // Identity mapping (pass through source sequence)
      const sourceSeq = heap.memory.readFloat(ptr + SEQ_META);
      result = seqNext(digest, heap, sourceSeq);
      break;
    }

    case SEQ_TYPE_FILTER: { // Identity filter (pass through source sequence)
      const sourceSeq = heap.memory.readFloat(ptr + SEQ_META);
      result = seqNext(digest, heap, sourceSeq);
      break;
    }

    case SEQ_TYPE_ZIP: { // Zipped sequence
      const seqA = heap.memory.readFloat(ptr + SEQ_META);
      const seqB = heap.memory.readFloat(ptr + SEQ_EXTRA);
      const valA = seqNext(digest, heap, seqA);
      const valB = seqNext(digest, heap, seqB);
      if (valA === NIL || valB === NIL) {
        // Free the owned vector when done
        const ownedVector = heap.memory.readFloat(ptr + SEQ_EXTRA + 4);
        if (ownedVector !== NIL) heap.free(ownedVector);
        return NIL;
      }

      // Reuse the stored vector, updating its elements
      let ownedVector = heap.memory.readFloat(ptr + SEQ_EXTRA + 4);
      if (ownedVector === NIL) {
        // Allocate vector only once
        ownedVector = vectorCreate(heap, [valA, valB]);
        heap.memory.writeFloat(ptr + SEQ_EXTRA + 4, ownedVector);
      } else {
        // Update vector in place
        vectorUpdate(heap, ownedVector, 0, valA);
        vectorUpdate(heap, ownedVector, 1, valB);
      }

      result = ownedVector;
      break;
    }
  }

  heap.memory.writeFloat(ptr + SEQ_POS, pos + 1);
  return result;
}
