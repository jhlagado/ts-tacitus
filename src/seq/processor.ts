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
import {
  seqCreate,
  SEQ_SRC_PROCESSOR,
  PROC_MAP,
  PROC_SIFT,
  PROC_TAKE,
  PROC_DROP,
  PROC_MULTI_SOURCE,
  PROC_FILTER,
} from './sequence';

/**
 * Creates a map processor sequence that transforms each value using a function
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence
 * @param func Pointer to the function to apply to each value
 * @returns Pointer to the newly created map processor sequence
 */
export function mapSeq(heap: Heap, source: number, func: number): number {
  // Create a processor sequence with:
  // - source sequence
  // - function to apply
  // - processor type (MAP)
  return seqCreate(heap, SEQ_SRC_PROCESSOR, [source, func, PROC_MAP]);
}

/**
 * Creates a multi-sequence processor that consumes multiple sequences in parallel
 * @param heap The heap object for memory management
 * @param sequences Array of pointers to the sequences to be consumed
 * @returns Pointer to the newly created multi-sequence processor
 */
export function multiSeq(heap: Heap, sequences: number[]): number {
  return seqCreate(heap, SEQ_SRC_PROCESSOR, [...sequences, PROC_MULTI_SOURCE]);
}

/**
 * Creates a sift processor sequence that only keeps values where the
 * corresponding mask value is true
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence
 * @param maskSeq Pointer to the mask sequence
 * @returns Pointer to the newly created sift processor sequence
 */
export function siftSeq(heap: Heap, source: number, maskSeq: number): number {
  return seqCreate(heap, SEQ_SRC_PROCESSOR, [source, maskSeq, PROC_SIFT]);
}

/**
 * Creates a take processor sequence that only processes the first n values
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence
 * @param count The number of values to take from the source sequence
 * @returns Pointer to the newly created take processor sequence
 */
export function takeSeq(heap: Heap, source: number, count: number): number {
  // Create a processor sequence with:
  // - source sequence
  // - count
  // - processor type (TAKE)
  return seqCreate(heap, SEQ_SRC_PROCESSOR, [source, count, PROC_TAKE]);
}

/**
 * Creates a drop processor sequence that skips the first n values
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence
 * @param count The number of values to drop from the source sequence
 * @returns Pointer to the newly created drop processor sequence
 */
export function dropSeq(heap: Heap, source: number, count: number): number {
  // Create a processor sequence with:
  // - source sequence
  // - count
  // - processor type (DROP)
  return seqCreate(heap, SEQ_SRC_PROCESSOR, [source, count, PROC_DROP]);
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
  // Create a processor sequence with:
  // - source sequence
  // - function to apply
  // - initial value
  // - processor type (SCAN)
  return seqCreate(heap, SEQ_SRC_PROCESSOR, [source, func, initialValue, 5]); // 5 = SCAN
}

/**
 * Creates a chain processor sequence that composes multiple processors
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence
 * @param processors Array of pointers to processor sequences to be chained
 * @returns Pointer to the newly created chain processor sequence
 */
export function chainSeq(heap: Heap, source: number, processors: number[]): number {
  // Create a processor sequence with:
  // - source sequence
  // - array of processor sequences
  // - processor type (CHAIN)
  return seqCreate(heap, SEQ_SRC_PROCESSOR, [source, ...processors, 6]); // 6 = CHAIN
}

/**
 * Creates a filter processor sequence that only keeps values for which
 * the predicate function returns true.
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence
 * @param predicateFunc Pointer to the predicate function
 * @returns Pointer to the newly created filter processor sequence
 */
export function filterSeq(heap: Heap, source: number, predicateFunc: number): number {
  return seqCreate(heap, SEQ_SRC_PROCESSOR, [source, predicateFunc, PROC_FILTER]);
}
