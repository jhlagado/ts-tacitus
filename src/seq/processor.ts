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
  
  return seqCreate(heap, SeqSourceType.PROCESSOR, [procType].concat(args));
}

/**
 * Creates a map processor sequence that transforms each value using a function
 * 
 * @detailed_description
 * The map processor applies a transformation function to each element of the source
 * sequence, producing a new sequence of the transformed values.
 *
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence
 * @param func Pointer to the function to apply to each value
 * @returns Pointer to the newly created map processor sequence, or NIL if inputs are invalid
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
 * when any of the source sequences is exhausted.
 *
 * @param heap The heap object for memory management
 * @param sequences Array of pointers to the sequences to be consumed
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
 * collected values at each step.
 *
 * @param heap The heap object for memory management
 * @param sequences Array of pointers to the sequences to be consumed
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
 * The sift processor advances both the source and mask sequences in lock-step and only
 * yields values from the source sequence when the corresponding value from the mask
 * sequence is truthy.
 *
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence
 * @param maskSeq Pointer to the mask sequence
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
 * then terminates.
 *
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence
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
 * then yields all remaining values.
 *
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence
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
 * The scan processor maintains an accumulator that is updated with each value from the
 * source sequence and yields the updated accumulator value after processing each element.
 *
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence
 * @param func Pointer to the function to apply to the accumulator and each value
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
 * in sequence to the source data.
 *
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence
 * @param processors Array of pointers to processor sequences to be chained
 * @returns Pointer to the newly created chain processor sequence, or NIL if allocation fails
 */
export function chainSeq(heap: Heap, source: number, processors: number[]): number {
  return createSimpleProcessor(heap, ProcType.CHAIN, [source].concat(processors));
}

/**
 * Creates a filter processor sequence that only keeps values for which
 * the predicate function returns true.
 * 
 * @detailed_description
 * The filter processor evaluates each value from the source sequence using a predicate
 * function and only yields values for which the predicate returns a truthy value.
 *
 * @param heap The heap object for memory management
 * @param source Pointer to the source sequence
 * @param predicateFunc Pointer to the predicate function
 * @returns Pointer to the newly created filter processor sequence, or NIL if allocation fails
 */
export function filterSeq(heap: Heap, source: number, pred: number): number {
  return seqCreate(heap, SeqSourceType.PROCESSOR, [ProcType.FILTER, source, pred]);
}
