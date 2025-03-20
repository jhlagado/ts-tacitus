import { Heap } from "../core/heap";
import {
  seqCreate,
  SEQ_SRC_RANGE,
  SEQ_SRC_VECTOR,
  SEQ_SRC_MULTI_SEQUENCE,
  SEQ_SRC_STRING,
} from "./sequence";

export function rangeSource(
  heap: Heap,
  start: number,
  end: number,
  step: number
): number {
  return seqCreate(heap, SEQ_SRC_RANGE, [start, step, end]);
}

export function vectorSource(heap: Heap, vectorPtr: number): number {
  return seqCreate(heap, SEQ_SRC_VECTOR, [vectorPtr]);
}

export function multiSequenceSource(heap: Heap, sequences: number[]): number {
  return seqCreate(heap, SEQ_SRC_MULTI_SEQUENCE, sequences);
}

export function stringSource(heap: Heap, strPtr: number): number {
  return seqCreate(heap, SEQ_SRC_STRING, [strPtr]);
}
