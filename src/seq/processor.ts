/**
 * @fileOverview This file defines sequence processors for the Tacit language
 * using a functional approach. It provides factory functions to create different
 * types of processor sequences.
 *
 * Architectural Observations:
 * - Sequence processors are implemented as tagged values with metadata
 * - The processing logic is centralized in the seqNext function in sequence.ts
 * - This approach avoids OOP and uses function composition for transforming sequences
 */

import { Heap } from '../heap/heap';
import { seqCreate } from './sequence';
import {
  SeqSourceType,
  ProcType
} from './sequence';

/**
 * Creates a map processor sequence that transforms each value using a function
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence
 * @param func Pointer to the function to apply to each value
 * @returns Pointer to the newly created map processor sequence
 */
export function mapSeq(heap: Heap, source: number, func: number): number {
  return seqCreate(heap, SeqSourceType.PROCESSOR, [ProcType.MAP, source, func]);
}

/**
 * Creates a multi-sequence processor that consumes multiple sequences in parallel
 * @param heap The heap object for memory management
 * @param sequences Array of pointers to the sequences to be consumed
 * @returns Pointer to the newly created multi-sequence processor
 */
export function multiSeq(heap: Heap, sequences: number[]): number {
  return seqCreate(heap, SeqSourceType.PROCESSOR, [ProcType.MULTI, ...sequences]);
}

/**
 * Creates a multi-source processor sequence that consumes multiple sequences in parallel
 * @param heap The heap object for memory management
 * @param sequences Array of pointers to the sequences to be consumed
 * @returns Pointer to the newly created multi-source processor
 */
export function multiSourceSeq(heap: Heap, sequences: number[]): number {
  return seqCreate(heap, SeqSourceType.PROCESSOR, [ProcType.MULTI_SOURCE, ...sequences]);
}

/**
 * Creates a sift processor sequence that only keeps values where the
 * corresponding mask value is true
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence
 * @param maskSeq Pointer to the mask sequence
 * @returns Pointer to the newly created sift processor sequence
 */
export function siftSeq(heap: Heap, source: number, mask: number): number {
  return seqCreate(heap, SeqSourceType.PROCESSOR, [ProcType.SIFT, source, mask]);
}

/**
 * Creates a take processor sequence that only processes the first n values
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence
 * @param count The number of values to take from the source sequence
 * @returns Pointer to the newly created take processor sequence
 */
export function takeSeq(heap: Heap, source: number, count: number): number {
  return seqCreate(heap, SeqSourceType.PROCESSOR, [ProcType.TAKE, source, count]);
}

/**
 * Creates a drop processor sequence that skips the first n values
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence
 * @param count The number of values to drop from the source sequence
 * @returns Pointer to the newly created drop processor sequence
 */
export function dropSeq(heap: Heap, source: number, count: number): number {
  return seqCreate(heap, SeqSourceType.PROCESSOR, [ProcType.DROP, source, count]);
}

/**
 * Creates a scan processor sequence that maintains an accumulator
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence
 * @param func Pointer to the function to apply to the accumulator and each value
 * @param initialValue The initial value of the accumulator
 * @returns Pointer to the newly created scan processor sequence
 */
export function scanSeq(heap: Heap, source: number, func: number, initialValue: number): number {
  // slot[0]=ProcType.SCAN, slot[1]=source, slot[2]=func, slot[3]=initialValue
  return seqCreate(heap, SeqSourceType.PROCESSOR, [ProcType.SCAN, source, func, initialValue]);
}

/**
 * Creates a chain processor sequence that composes multiple processors
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence
 * @param processors Array of pointers to processor sequences to be chained
 * @returns Pointer to the newly created chain processor sequence
 */
export function chainSeq(heap: Heap, source: number, processors: number[]): number {
  // slot[0]=ProcType.CHAIN, slot[1]=source, slots[2..]=processors
  return seqCreate(heap, SeqSourceType.PROCESSOR, [ProcType.CHAIN, source, ...processors]);
}

/**
 * Creates a filter processor sequence that only keeps values for which
 * the predicate function returns true.
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence
 * @param predicateFunc Pointer to the predicate function
 * @returns Pointer to the newly created filter processor sequence
 */
export function filterSeq(heap: Heap, source: number, pred: number): number {
  return seqCreate(heap, SeqSourceType.PROCESSOR, [ProcType.FILTER, source, pred]);
}
