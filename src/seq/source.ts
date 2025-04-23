import { Heap } from '../heap/heap';
import {
  ProcType,
  seqCreate,
  SeqSourceType,
} from './sequence';

export function rangeSource(heap: Heap, start: number, end: number, step: number): number {
  return seqCreate(heap, SeqSourceType.RANGE, [start, step, end]);
}

export function vectorSource(heap: Heap, vectorPtr: number): number {
  return seqCreate(heap, SeqSourceType.VECTOR, [vectorPtr]);
}

export function multiSequenceSource(heap: Heap, sequences: number[]): number {
  // Create a new array with sequences and append ProcType.MULTI_SOURCE at the end
  const meta = sequences.concat([ProcType.MULTI_SOURCE]);
  return seqCreate(heap, SeqSourceType.PROCESSOR, meta);
}

export function stringSource(heap: Heap, strPtr: number): number {
  return seqCreate(heap, SeqSourceType.STRING, [strPtr]);
}

export function constantSource(heap: Heap, value: number): number {
  return seqCreate(heap, SeqSourceType.CONSTANT, [value]);
}

export function dictionarySource(heap: Heap, dictPtr: number): number {
  return seqCreate(heap, SeqSourceType.DICT, [dictPtr, 0]);
}
