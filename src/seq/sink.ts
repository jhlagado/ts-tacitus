// File: src/sink.ts

import { Heap } from "../data/heap";
import { seqNext } from "./sequence";
import { UNDEF } from "../tagged-value";

/**
 * seqReduce consumes the entire sequence and reduces it to a single value using the reducer function.
 *
 * @param heap - The heap instance.
 * @param seq - The sequence pointer.
 * @param reducer - A function that combines an accumulator and the next element.
 * @param initial - The initial accumulator value.
 * @returns The final accumulated value.
 */
export function seqReduce(
  heap: Heap,
  seq: number,
  reducer: (acc: number, value: number) => number,
  initial: number
): number {
  let acc = initial;
  let val: number;
  while ((val = seqNext(heap, seq)) !== UNDEF) {
    acc = reducer(acc, val);
  }
  return acc;
}

/**
 * seqRealize consumes the entire sequence and returns an array of all its elements.
 *
 * @param heap - The heap instance.
 * @param seq - The sequence pointer.
 * @returns An array of numbers produced by the sequence.
 */
export function seqRealize(heap: Heap, seq: number): number[] {
  const result: number[] = [];
  let val: number;
  while ((val = seqNext(heap, seq)) !== UNDEF) {
    result.push(val);
  }
  return result;
}

/**
 * seqForEach consumes the entire sequence and executes the provided side-effect function on each element.
 *
 * @param heap - The heap instance.
 * @param seq - The sequence pointer.
 * @param fn - A function to execute on each element.
 */
export function seqForEach(
  heap: Heap,
  seq: number,
  fn: (value: number) => void
): void {
  let val: number;
  while ((val = seqNext(heap, seq)) !== UNDEF) {
    fn(val);
  }
}

/**
 * seqFirst returns the first element of the sequence, or UNDEF if the sequence is empty.
 *
 * @param heap - The heap instance.
 * @param seq - The sequence pointer.
 * @returns The first element, or UNDEF.
 */
export function seqFirst(heap: Heap, seq: number): number {
  return seqNext(heap, seq);
}

/**
 * seqLast iterates through the sequence and returns the last element, or UNDEF if empty.
 *
 * @param heap - The heap instance.
 * @param seq - The sequence pointer.
 * @returns The last element, or UNDEF.
 */
export function seqLast(heap: Heap, seq: number): number {
  let last = UNDEF;
  let val: number;
  while ((val = seqNext(heap, seq)) !== UNDEF) {
    last = val;
  }
  return last;
}

/**
 * seqFind returns the first element that satisfies the predicate, or UNDEF if none found.
 *
 * @param heap - The heap instance.
 * @param seq - The sequence pointer.
 * @param predicate - A function that tests each element.
 * @returns The first matching element, or UNDEF.
 */
export function seqFind(
  heap: Heap,
  seq: number,
  predicate: (value: number) => boolean
): number {
  let val: number;
  while ((val = seqNext(heap, seq)) !== UNDEF) {
    if (predicate(val)) return val;
  }
  return UNDEF;
}

/**
 * seqFindIndex returns the index of the first element that satisfies the predicate, or -1 if none found.
 *
 * @param heap - The heap instance.
 * @param seq - The sequence pointer.
 * @param predicate - A function that tests each element.
 * @returns The index of the matching element, or -1.
 */
export function seqFindIndex(
  heap: Heap,
  seq: number,
  predicate: (value: number) => boolean
): number {
  let index = 0;
  let val: number;
  while ((val = seqNext(heap, seq)) !== UNDEF) {
    if (predicate(val)) return index;
    index++;
  }
  return -1;
}

/**
 * seqSome returns true if at least one element in the sequence satisfies the predicate.
 *
 * @param heap - The heap instance.
 * @param seq - The sequence pointer.
 * @param predicate - A function that tests each element.
 * @returns True if any element passes, false otherwise.
 */
export function seqSome(
  heap: Heap,
  seq: number,
  predicate: (value: number) => boolean
): boolean {
  let val: number;
  while ((val = seqNext(heap, seq)) !== UNDEF) {
    if (predicate(val)) return true;
  }
  return false;
}

/**
 * seqEvery returns true if every element in the sequence satisfies the predicate.
 *
 * @param heap - The heap instance.
 * @param seq - The sequence pointer.
 * @param predicate - A function that tests each element.
 * @returns True if all elements pass, false if any fail.
 */
export function seqEvery(
  heap: Heap,
  seq: number,
  predicate: (value: number) => boolean
): boolean {
  let val: number;
  while ((val = seqNext(heap, seq)) !== UNDEF) {
    if (!predicate(val)) return false;
  }
  return true;
}

/**
 * seqCount returns the total number of elements in the sequence.
 *
 * @param heap - The heap instance.
 * @param seq - The sequence pointer.
 * @returns The count of elements.
 */
export function seqCount(heap: Heap, seq: number): number {
  let count = 0;
  while (seqNext(heap, seq) !== UNDEF) {
    count++;
  }
  return count;
}
