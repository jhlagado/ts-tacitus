// File: src/sink.ts

import { Heap } from "../data/heap";
import { UNDEF } from "../tagged-value";
import { seqNext } from "./sequence";

/**
 * seqReduce consumes the sequence and reduces it to a single value using the reducer function.
 */
export function seqReduce(
  heap: Heap,
  seqPtr: number,
  initial: number,
  reducer: (acc: number, x: number) => number
): number {
  let acc = initial;
  while (true) {
    const x = seqNext(heap, seqPtr);
    if (x === UNDEF) break;
    acc = reducer(acc, x);
  }
  return acc;
}

/**
 * seqRealize converts the entire sequence into a JavaScript array.
 */
export function seqRealize(heap: Heap, seqPtr: number): number[] {
  const result: number[] = [];
  while (true) {
    const x = seqNext(heap, seqPtr);
    if (x === UNDEF) break;
    result.push(x);
  }
  return result;
}

/**
 * seqForEach iterates over the sequence, applying the consumer function (which may have side effects) to each element.
 */
export function seqForEach(
  heap: Heap,
  seqPtr: number,
  consumer: (x: number) => void
): void {
  while (true) {
    const x = seqNext(heap, seqPtr);
    if (x === UNDEF) break;
    consumer(x);
  }
}
