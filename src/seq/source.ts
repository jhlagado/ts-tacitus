import { Heap } from '../heap/heap';
import {
  seqCreate,
  SEQ_SRC_RANGE,
  SEQ_SRC_VECTOR,
  SEQ_SRC_STRING,
  SEQ_SRC_PROCESSOR,
  PROC_MULTI_SOURCE,
  SEQ_SRC_CONSTANT,
  SEQ_SRC_DICT,
} from './sequence';

export function rangeSource(heap: Heap, start: number, end: number, step: number): number {
  return seqCreate(heap, SEQ_SRC_RANGE, [start, step, end]);
}

export function vectorSource(heap: Heap, vectorPtr: number): number {
  return seqCreate(heap, SEQ_SRC_VECTOR, [vectorPtr]);
}

export function multiSequenceSource(heap: Heap, sequences: number[]): number {
  return seqCreate(heap, SEQ_SRC_PROCESSOR, [...sequences, PROC_MULTI_SOURCE]);
}

export function stringSource(heap: Heap, strPtr: number): number {
  return seqCreate(heap, SEQ_SRC_STRING, [strPtr]);
}

export function constantSource(heap: Heap, value: number): number {
  return seqCreate(heap, SEQ_SRC_CONSTANT, [value]);
}

export function dictionarySource(heap: Heap, dictPtr: number): number {
  return seqCreate(heap, SEQ_SRC_DICT, [dictPtr, 0]);
}
