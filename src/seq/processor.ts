// File: src/processor.ts

import { seqNext } from "./sequence";
import { UNDEF } from "../tagged-value";
import { Heap } from "../data/heap";

/**
 * seqMap
 * Returns a function that applies a mapping function to each element of the source sequence.
 *
 * @param heap - The heap instance.
 * @param seq - The source sequence pointer.
 * @param mapper - Function transforming each element.
 * @returns A function that returns the next mapped element or UNDEF if exhausted.
 */
export function seqMap(
  heap: Heap,
  seq: number,
  mapper: (value: number) => number
): () => number {
  return () => {
    const val = seqNext(heap, seq);
    return val === UNDEF ? UNDEF : mapper(val);
  };
}

/**
 * seqScan
 * Returns a function that performs a scan (cumulative reduction) over the source sequence.
 *
 * @param heap - The heap instance.
 * @param seq - The source sequence pointer.
 * @param initial - The initial accumulator value.
 * @param accumulator - Function that combines the accumulator and the next element.
 * @returns A function that returns the next accumulated value or UNDEF if exhausted.
 */
export function seqScan(
  heap: Heap,
  seq: number,
  initial: number,
  accumulator: (acc: number, value: number) => number
): () => number {
  let acc = initial;
  return () => {
    const val = seqNext(heap, seq);
    if (val === UNDEF) return UNDEF;
    acc = accumulator(acc, val);
    return acc;
  };
}

/**
 * seqFilter
 * Returns a function that filters elements from the source sequence.
 *
 * @param heap - The heap instance.
 * @param seq - The source sequence pointer.
 * @param predicate - Function that returns true for elements to keep.
 * @returns A function that returns the next element passing the predicate or UNDEF if exhausted.
 */
export function seqFilter(
  heap: Heap,
  seq: number,
  predicate: (value: number) => boolean
): () => number {
  return () => {
    let val: number;
    do {
      val = seqNext(heap, seq);
      if (val === UNDEF) return UNDEF;
    } while (!predicate(val));
    return val;
  };
}

/**
 * seqTake
 * Returns a function that yields only the first n elements of the source sequence.
 *
 * @param heap - The heap instance.
 * @param seq - The source sequence pointer.
 * @param n - Maximum number of elements to yield.
 * @returns A function that returns the next element (up to n elements) or UNDEF when done.
 */
export function seqTake(heap: Heap, seq: number, n: number): () => number {
  let count = 0;
  return () => {
    if (count >= n) return UNDEF;
    const val = seqNext(heap, seq);
    if (val !== UNDEF) count++;
    return val;
  };
}

/**
 * seqDrop
 * Returns a function that skips the first n elements of the source sequence.
 *
 * @param heap - The heap instance.
 * @param seq - The source sequence pointer.
 * @param n - Number of elements to skip.
 * @returns A function that returns the next element after skipping n elements, or UNDEF if exhausted.
 */
export function seqDrop(heap: Heap, seq: number, n: number): () => number {
  // Skip n elements immediately.
  for (let i = 0; i < n; i++) {
    seqNext(heap, seq);
  }
  return () => seqNext(heap, seq);
}

/**
 * seqSlice
 * Returns a function that yields a slice of the source sequence starting at index 'start'
 * and taking the next n elements.
 *
 * @param heap - The heap instance.
 * @param seq - The source sequence pointer.
 * @param start - The starting index to slice from.
 * @param n - The number of elements to take.
 * @returns A function that returns the next element from the slice or UNDEF when done.
 */
export function seqSlice(
  heap: Heap,
  seq: number,
  start: number,
  n: number
): () => number {
  // Drop the first 'start' elements, then take the next n elements.
  seqDrop(heap, seq, start);
  return seqTake(heap, seq, n);
}

/**
 * seqFlatMap
 * Returns a function that maps each element of the source sequence to a sub-sequence
 * (using the provided mapper function) and flattens the resulting sequences into one.
 *
 * @param heap - The heap instance.
 * @param seq - The source sequence pointer.
 * @param mapper - Function mapping each element to a sequence pointer.
 * @returns A function that returns the next flattened element or UNDEF if exhausted.
 */
export function seqFlatMap(
  heap: Heap,
  seq: number,
  mapper: (value: number) => number
): () => number {
  let currentSubSeq: (() => number) | null = null;
  return () => {
    while (true) {
      if (currentSubSeq) {
        const val = currentSubSeq();
        if (val !== UNDEF) return val;
        currentSubSeq = null;
      }
      const srcVal = seqNext(heap, seq);
      if (srcVal === UNDEF) return UNDEF;
      const subSeq = mapper(srcVal);
      // Define currentSubSeq as a closure that yields the sub-sequence elements.
      currentSubSeq = () => seqNext(heap, subSeq);
    }
  };
}

/**
 * seqZip
 * Returns a function that zips two sequences together into pairs.
 *
 * @param heap - The heap instance.
 * @param seq1 - The first source sequence pointer.
 * @param seq2 - The second source sequence pointer.
 * @returns A function that returns the next pair [val1, val2] or UNDEF if either sequence is exhausted.
 */
export function seqZip(
  heap: Heap,
  seq1: number,
  seq2: number
): () => [number, number] | number {
  return () => {
    const val1 = seqNext(heap, seq1);
    const val2 = seqNext(heap, seq2);
    if (val1 === UNDEF || val2 === UNDEF) return UNDEF;
    return [val1, val2];
  };
}

/**
 * seqConcat
 * Returns a function that concatenates two sequences.
 *
 * @param heap - The heap instance.
 * @param seq1 - The first source sequence pointer.
 * @param seq2 - The second source sequence pointer.
 * @returns A function that returns the next element from the concatenated sequence, or UNDEF if both are exhausted.
 */
export function seqConcat(
  heap: Heap,
  seq1: number,
  seq2: number
): () => number {
  let usingFirst = true;
  return () => {
    if (usingFirst) {
      const val = seqNext(heap, seq1);
      if (val !== UNDEF) return val;
      usingFirst = false;
    }
    return seqNext(heap, seq2);
  };
}
