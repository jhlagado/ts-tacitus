/**
 * @file src/seq/processor.ts
 * @brief Factory functions for creating sequence processors in the Tacit language.
 * 
 * @detailed_description
 * This file defines a set of factory functions that create different types of sequence
 * processors for the Tacit language. Each factory function creates a specialized
 * sequence processor that transforms or filters data in a specific way. The processors
 * are implemented using a functional approach, avoiding object-oriented patterns in
 * favor of function composition and data transformation.
 * 
 * @memory_management
 * Sequence processors are heap-allocated objects with reference counting. When a
 * processor references another sequence (source or mask), the reference count of
 * that sequence is incremented during creation. The reference counting is handled
 * by the seqCreate function in sequence.ts. When a processor is no longer needed,
 * its cleanup handler will decrement the reference counts of any sequences it holds.
 * 
 * @architectural_observations
 * - Sequence processors are implemented as tagged values with metadata stored in vectors
 * - Each processor has a specific type (ProcType) that determines its behavior
 * - The actual processing logic is centralized in the seqNext function in sequence.ts
 * - This approach avoids OOP and uses function composition for transforming sequences
 * - Processors can be chained together to create complex transformations
 * - The design supports structural sharing and lazy evaluation
 * 
 * @related_modules
 * - sequence.ts: Core sequence functionality and seqNext implementation
 * - processorHandlers.ts: Handler functions for each processor type
 * - sequenceView.ts: Helper class for accessing sequence metadata
 */

import { Heap } from '../heap/heap';
import { seqCreate } from './sequence';
import {
  SeqSourceType,
  ProcType
} from './sequence';
import { NIL, isNIL } from '../core/tagged';

/**
 * Helper function to create processor sequences with minimal boilerplate
 * @param heap The heap object for memory management
 * @param procType The type of processor to create
 * @param args Array of arguments to pass to the processor (starting with source)
 * @param validateArgs Optional function to perform additional validation on arguments
 * @returns Pointer to the newly created processor sequence, or NIL if creation fails
 * 
 * Note: This function maintains the same behavior as direct calls to seqCreate,
 * including reference counting for heap-allocated objects. The seqCreate function
 * will increment reference counts for all heap-allocated values in the args array.
 */
function createSimpleProcessor(
  heap: Heap, 
  procType: ProcType, 
  args: number[],
  validateArgs?: (args: number[]) => boolean
): number {
  // Validate that none of the arguments are NIL
  for (const arg of args) {
    if (isNIL(arg)) {
      return NIL;
    }
  }
  
  // Perform additional validation if provided
  if (validateArgs && !validateArgs(args)) {
    return NIL;
  }
  
  return seqCreate(heap, SeqSourceType.PROCESSOR, [procType, ...args]);
}

/**
 * Creates a map processor sequence that transforms each value using a function
 * 
 * @detailed_description
 * The map processor applies a transformation function to each element of the source
 * sequence, producing a new sequence of the transformed values. This implements the
 * classic functional 'map' operation, which applies a function to each element of
 * a collection.
 *
 * @memory_management
 * This function increments the reference count of both the source sequence and the
 * function pointer when creating the processor. These references are released when
 * the processor is freed.
 *
 * @example
 * // Create a sequence that doubles each value in the source sequence
 * const doubleFunc = createFunction(heap, ...); // Function that doubles its input
 * const sourceSeq = rangeSeq(heap, 1, 1, 10);  // Sequence of numbers 1-10
 * const doubled = mapSeq(heap, sourceSeq, doubleFunc); // Sequence of numbers 2-20
 *
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence (reference count is incremented)
 * @param func Pointer to the function to apply to each value (reference count is incremented)
 * @returns Pointer to the newly created map processor sequence, or NIL if allocation fails or inputs are invalid
 */
export function mapSeq(heap: Heap, source: number, func: number): number {
  if (isNIL(source)) {
    return NIL; // Source sequence cannot be NIL
  }
  
  if (isNIL(func)) {
    return NIL; // Function cannot be NIL
  }
  
  return seqCreate(heap, SeqSourceType.PROCESSOR, [ProcType.MAP, source, func]);
}

/**
 * Creates a multi-sequence processor that consumes multiple sequences in parallel
 * 
 * @detailed_description
 * The multi-sequence processor advances all source sequences in lock-step and terminates
 * when any of the source sequences is exhausted (returns NIL). This is useful for
 * operations that need to process multiple sequences together, such as zipping or
 * combining sequences.
 *
 * @memory_management
 * This function increments the reference count of each sequence in the sequences array.
 * These references are released when the processor is freed.
 *
 * @example
 * // Create a sequence that processes two sequences in parallel
 * const seq1 = rangeSeq(heap, 1, 1, 5);  // Sequence of numbers 1-5
 * const seq2 = rangeSeq(heap, 10, 10, 50); // Sequence of numbers 10-50
 * const multi = multiSeq(heap, [seq1, seq2]); // Processes both sequences together
 *
 * @param heap The heap object for memory management
 * @param sequences Array of pointers to the sequences to be consumed (reference counts are incremented)
 * @returns Pointer to the newly created multi-sequence processor, or NIL if allocation fails
 */
export function multiSeq(heap: Heap, sequences: number[]): number {
  return createSimpleProcessor(heap, ProcType.MULTI, sequences);
}

/**
 * Creates a multi-source processor sequence that consumes multiple sequences in parallel
 * 
 * @detailed_description
 * The multi-source processor advances all source sequences in lock-step and yields all
 * collected values at each step. It terminates when any of the source sequences is
 * exhausted (returns NIL). Unlike multiSeq which only signals when sequences are consumed,
 * this processor actually yields the values from all sequences at each step.
 *
 * @memory_management
 * This function increments the reference count of each sequence in the sequences array.
 * These references are released when the processor is freed.
 *
 * @example
 * // Create a sequence that yields values from multiple sequences
 * const seq1 = rangeSeq(heap, 1, 1, 5);  // Sequence of numbers 1-5
 * const seq2 = rangeSeq(heap, 10, 10, 50); // Sequence of numbers 10-50
 * const multiSource = multiSourceSeq(heap, [seq1, seq2]); // Yields values from both sequences
 *
 * @param heap The heap object for memory management
 * @param sequences Array of pointers to the sequences to be consumed (reference counts are incremented)
 * @returns Pointer to the newly created multi-source processor, or NIL if allocation fails
 */
export function multiSourceSeq(heap: Heap, sequences: number[]): number {
  return createSimpleProcessor(heap, ProcType.MULTI_SOURCE, sequences);
}

/**
 * Creates a sift processor sequence that only keeps values where the
 * corresponding mask value is true
 * 
 * @detailed_description
 * The sift processor advances both the source and mask sequences in lock-step. It only
 * yields values from the source sequence when the corresponding value from the mask
 * sequence is truthy. This is similar to a filter operation, but uses a separate
 * sequence to determine which values to keep rather than a predicate function.
 *
 * @memory_management
 * This function increments the reference count of both the source sequence and the
 * mask sequence. These references are released when the processor is freed.
 *
 * @example
 * // Create a sequence that only keeps values where the mask is true
 * const sourceSeq = rangeSeq(heap, 1, 1, 10);  // Sequence of numbers 1-10
 * const maskSeq = vectorSeq(heap, [true, false, true, false, true, false, true, false, true, false]);
 * const sifted = siftSeq(heap, sourceSeq, maskSeq); // Yields 1, 3, 5, 7, 9
 *
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence (reference count is incremented)
 * @param maskSeq Pointer to the mask sequence (reference count is incremented)
 * @returns Pointer to the newly created sift processor sequence, or NIL if allocation fails
 */
export function siftSeq(heap: Heap, source: number, mask: number): number {
  return createSimpleProcessor(heap, ProcType.SIFT, [source, mask]);
}

/**
 * Creates a take processor sequence that only processes the first n values
 * 
 * @detailed_description
 * The take processor yields only the first 'count' values from the source sequence,
 * then terminates (returns NIL) regardless of whether the source sequence has more
 * values. This is useful for limiting the length of potentially infinite sequences
 * or for pagination.
 *
 * @memory_management
 * This function increments the reference count of the source sequence.
 * This reference is released when the processor is freed.
 *
 * @example
 * // Create a sequence that only takes the first 5 values
 * const sourceSeq = rangeSeq(heap, 1, 1, 100);  // Sequence of numbers 1-100
 * const taken = takeSeq(heap, sourceSeq, 5); // Yields only 1, 2, 3, 4, 5
 *
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence (reference count is incremented)
 * @param count The number of values to take from the source sequence
 * @returns Pointer to the newly created take processor sequence, or NIL if allocation fails
 */
export function takeSeq(heap: Heap, source: number, count: number): number {
  return seqCreate(heap, SeqSourceType.PROCESSOR, [ProcType.TAKE, source, count]);
}

/**
 * Creates a drop processor sequence that skips the first n values
 * 
 * @detailed_description
 * The drop processor skips the first 'count' values from the source sequence,
 * then yields all remaining values. This is useful for pagination or for skipping
 * a known number of unwanted values at the beginning of a sequence.
 *
 * @memory_management
 * This function increments the reference count of the source sequence.
 * This reference is released when the processor is freed.
 *
 * @example
 * // Create a sequence that skips the first 5 values
 * const sourceSeq = rangeSeq(heap, 1, 1, 10);  // Sequence of numbers 1-10
 * const dropped = dropSeq(heap, sourceSeq, 5); // Yields only 6, 7, 8, 9, 10
 *
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence (reference count is incremented)
 * @param count The number of values to drop from the source sequence
 * @returns Pointer to the newly created drop processor sequence, or NIL if allocation fails
 */
export function dropSeq(heap: Heap, source: number, count: number): number {
  return createSimpleProcessor(heap, ProcType.DROP, [source, count]);
}

/**
 * Creates a scan processor sequence that maintains an accumulator
 * 
 * @detailed_description
 * The scan processor (also known as a cumulative fold or prefix sum) maintains an
 * accumulator that is updated with each value from the source sequence. It yields
 * the updated accumulator value after processing each element. This is useful for
 * running totals, moving averages, or any computation that depends on previous results.
 *
 * @memory_management
 * This function increments the reference count of both the source sequence and the
 * function pointer. These references are released when the processor is freed.
 * The initialValue is stored directly in the processor's metadata and does not
 * affect reference counting unless it is a heap-allocated value.
 *
 * @example
 * // Create a sequence that calculates running sum
 * const sourceSeq = rangeSeq(heap, 1, 1, 5);  // Sequence of numbers 1-5
 * const addFunc = createFunction(heap, ...);  // Function that adds two numbers
 * const runningSum = scanSeq(heap, sourceSeq, addFunc, 0); // Yields 1, 3, 6, 10, 15
 *
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence (reference count is incremented)
 * @param func Pointer to the function to apply to the accumulator and each value (reference count is incremented)
 * @param initialValue The initial value of the accumulator
 * @returns Pointer to the newly created scan processor sequence, or NIL if allocation fails
 */
export function scanSeq(heap: Heap, source: number, func: number, initialValue: number): number {
  return createSimpleProcessor(heap, ProcType.SCAN, [source, func, initialValue]);
}

/**
 * Creates a chain processor sequence that composes multiple processors
 * 
 * @detailed_description
 * The chain processor composes multiple processor sequences together, applying them
 * in sequence to the source data. This allows for building complex transformations
 * by combining simpler ones. The processors are applied in the order they appear in
 * the array.
 *
 * @memory_management
 * This function increments the reference count of the source sequence and each
 * processor in the processors array. These references are released when the
 * chain processor is freed.
 *
 * @example
 * // Create a sequence that applies multiple transformations
 * const sourceSeq = rangeSeq(heap, 1, 1, 10);  // Sequence of numbers 1-10
 * const doubleFunc = createFunction(heap, ...); // Function that doubles its input
 * const evenPred = createFunction(heap, ...);   // Predicate that checks if a number is even
 * const doubled = mapSeq(heap, sourceSeq, doubleFunc); // Double each value
 * const evenOnly = filterSeq(heap, doubled, evenPred);  // Keep only even values
 * // Equivalent to the above two steps:
 * const combined = chainSeq(heap, sourceSeq, [doubled, evenOnly]);
 *
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence (reference count is incremented)
 * @param processors Array of pointers to processor sequences to be chained (reference counts are incremented)
 * @returns Pointer to the newly created chain processor sequence, or NIL if allocation fails
 */
export function chainSeq(heap: Heap, source: number, processors: number[]): number {
  return createSimpleProcessor(heap, ProcType.CHAIN, [source, ...processors]);
}

/**
 * Creates a filter processor sequence that only keeps values for which
 * the predicate function returns true.
 * 
 * @detailed_description
 * The filter processor evaluates each value from the source sequence using a predicate
 * function and only yields values for which the predicate returns a truthy value.
 * This implements the classic functional 'filter' operation, which selects elements
 * from a collection based on a condition.
 *
 * @memory_management
 * This function increments the reference count of both the source sequence and the
 * predicate function. These references are released when the processor is freed.
 *
 * @example
 * // Create a sequence that only keeps even numbers
 * const sourceSeq = rangeSeq(heap, 1, 1, 10);  // Sequence of numbers 1-10
 * const isEven = createFunction(heap, ...);    // Predicate that checks if a number is even
 * const evenOnly = filterSeq(heap, sourceSeq, isEven); // Yields 2, 4, 6, 8, 10
 *
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence (reference count is incremented)
 * @param predicateFunc Pointer to the predicate function (reference count is incremented)
 * @returns Pointer to the newly created filter processor sequence, or NIL if allocation fails
 */
export function filterSeq(heap: Heap, source: number, pred: number): number {
  return seqCreate(heap, SeqSourceType.PROCESSOR, [ProcType.FILTER, source, pred]);
}
