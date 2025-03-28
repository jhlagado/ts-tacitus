/**
 * @fileOverview This file defines sequence processors for the Tacit language.
 * It provides functions to create different types of processor sequences and
 * classes that implement the sequence processing logic.
 *
 * Architectural Observations:
 * - This file complements `src/seq/sequence.ts` by providing a higher-level
 *   abstraction for creating and working with sequence processors.
 * - It uses a combination of factory functions (e.g., `mapSeq`, `filterSeq`)
 *   and classes (e.g., `MapProcessor`, `FilterProcessor`) to offer flexibility
 *   in how sequence processing is defined and used.  The classes are not used
 *   by the `seqNext` function, suggesting there may be two implementations
 *   or that the class implementation is not yet complete.
 */

import { Heap } from "../heap/heap";
import { isNIL, NIL } from "../core/tagged";
import { VM } from "../core/vm";
import {
  seqNext,
  seqCreate,
  SEQ_SRC_PROCESSOR,
  PROC_MAP,
  PROC_FILTER,
  PROC_TAKE,
  PROC_DROP,
  PROC_MULTI_SOURCE
} from "./sequence";

/**
 * Creates a map processor sequence that transforms each value using a function.
 * @param {Heap} heap - The heap object for memory management.
 * @param {number} source - The pointer to the source sequence.
 * @param {number} func - The pointer to the function to apply to each value.
 * @returns {number} - A pointer to the newly created map processor sequence.
 */
export function mapSeq(heap: Heap, source: number, func: number): number {
  // Create a processor sequence with:
  // - source sequence
  // - function to apply
  // - processor type (MAP)
  return seqCreate(heap, SEQ_SRC_PROCESSOR, [source, func, PROC_MAP]);
}

/**
 * Creates a multi-sequence processor that consumes multiple sequences in parallel.
 * @param {Heap} heap - The heap object for memory management.
 * @param {number[]} sequences - An array of pointers to the sequences to be consumed.
 * @returns {number} - A pointer to the newly created multi-sequence processor.
 */
export function multiSeq(heap: Heap, sequences: number[]): number {
  return seqCreate(heap, SEQ_SRC_PROCESSOR, [...sequences, PROC_MULTI_SOURCE]);
}

/**
 * Creates a filter processor sequence that only keeps values where the
 * corresponding mask value is true.
 * @param {Heap} heap - The heap object for memory management.
 * @param {number} source - The pointer to the source sequence.
 * @param {number} maskSeq - The pointer to the mask sequence.
 * @returns {number} - A pointer to the newly created filter processor sequence.
 */
export function filterSeq(heap: Heap, source: number, maskSeq: number): number {
  return seqCreate(heap, SEQ_SRC_PROCESSOR, [source, maskSeq, PROC_FILTER]);
}

/**
 * Creates a take processor sequence that only processes the first n values.
 * @param {Heap} heap - The heap object for memory management.
 * @param {number} source - The pointer to the source sequence.
 * @param {number} count - The number of values to take from the source sequence.
 * @returns {number} - A pointer to the newly created take processor sequence.
 */
export function takeSeq(heap: Heap, source: number, count: number): number {
  // Create a processor sequence with:
  // - source sequence
  // - count
  // - processor type (TAKE)
  return seqCreate(heap, SEQ_SRC_PROCESSOR, [source, count, PROC_TAKE]);
}

/**
 * Creates a drop processor sequence that skips the first n values.
 * @param {Heap} heap - The heap object for memory management.
 * @param {number} source - The pointer to the source sequence.
 * @param {number} count - The number of values to drop from the source sequence.
 * @returns {number} - A pointer to the newly created drop processor sequence.
 */
export function dropSeq(heap: Heap, source: number, count: number): number {
  // Create a processor sequence with:
  // - source sequence
  // - count
  // - processor type (DROP)
  return seqCreate(heap, SEQ_SRC_PROCESSOR, [source, count, PROC_DROP]);
}

/**
 * Creates a scan processor sequence that maintains an accumulator.
 * @param {Heap} heap - The heap object for memory management.
 * @param {number} source - The pointer to the source sequence.
 * @param {number} func - The pointer to the function to apply to the accumulator and each value.
 * @param {number} initialValue - The initial value of the accumulator.
 * @returns {number} - A pointer to the newly created scan processor sequence.
 */
export function scanSeq(heap: Heap, source: number, func: number, initialValue: number): number {
  // Create a processor sequence with:
  // - source sequence
  // - function to apply
  // - initial value
  // - processor type (SCAN), represented by the value 5
  return seqCreate(heap, SEQ_SRC_PROCESSOR, [source, func, initialValue, 5]); // 5 = SCAN
}

/**
 * Creates a chain processor sequence that composes multiple processors.
 * @param {Heap} heap - The heap object for memory management.
 * @param {number} source - The pointer to the source sequence.
 * @param {number[]} processors - An array of pointers to processor sequences to be chained.
 * @returns {number} - A pointer to the newly created chain processor sequence.
 */
export function chainSeq(heap: Heap, source: number, processors: number[]): number {
  // Create a processor sequence with:
  // - source sequence
  // - array of processor sequences
  // - processor type (CHAIN), represented by the value 6
  return seqCreate(heap, SEQ_SRC_PROCESSOR, [source, ...processors, 6]); // 6 = CHAIN
}

/**
 * Base interface for sequence processors.  This interface defines the `next`
 * method that all sequence processors must implement to provide the next value
 * in the sequence.
 */
export interface SequenceProcessor {
  /**
   * Retrieves the next value from the sequence.
   * @param {Heap} heap - The heap object for memory management.
   * @param {VM} vm - The virtual machine instance.
   * @returns {number} - The next value in the sequence, or NIL if the sequence is exhausted.
   */
  next(heap: Heap, vm: VM): number;
}

/**
 * Base class for all sequence processors that provides common functionality.
 * This abstract class implements the `SequenceProcessor` interface and provides
 * a constructor to initialize the source sequence and a helper method to
 * retrieve the next value from the source.
 */
abstract class BaseProcessor implements SequenceProcessor {
  constructor(protected source: number) {}

  /**
   * Retrieves the next value from the source sequence.
   * @protected
   * @param {Heap} heap - The heap object for memory management.
   * @param {VM} vm - The virtual machine instance.
   * @returns {number} - The next value from the source sequence.
   */
  protected getNextValue(heap: Heap, vm: VM): number {
    seqNext(heap, vm, this.source);
    return vm.pop();
  }

  /**
   * Abstract method to retrieve the next value from the processed sequence.
   * Must be implemented by subclasses.
   * @abstract
   * @param {Heap} heap - The heap object for memory management.
   * @param {VM} vm - The virtual machine instance.
   * @returns {number} - The next value in the processed sequence.
   */
  abstract next(heap: Heap, vm: VM): number;
}

/**
 * Filter processor that only keeps values where the predicate returns true.
 * This class extends `BaseProcessor` and filters the source sequence based on
 * a provided predicate function.
 */
export class FilterProcessor extends BaseProcessor {
  /**
   * Creates a new FilterProcessor instance.
   * @param {number} source - The pointer to the source sequence.
   * @param {number} predicate - The pointer to the predicate function.
   */
  constructor(source: number, private predicate: number) {
    super(source);
  }

  /**
   * Retrieves the next value from the filtered sequence.
   * @param {Heap} heap - The heap object for memory management.
   * @param {VM} vm - The virtual machine instance.
   * @returns {number} - The next value that satisfies the predicate, or NIL if the sequence is exhausted.
   */
  next(heap: Heap, vm: VM): number {
    while (true) {
      const value = this.getNextValue(heap, vm);
      if (isNIL(value)) {
        return value;
      }

      vm.push(value);
      vm.push(this.predicate);
      vm.eval();

      const keepValue = vm.pop();
      if (keepValue) {
        return value;
      }
    }
  }
}

/**
 * Map processor that transforms each value using a function.
 * This class extends `BaseProcessor` and applies a provided function to each
 * value in the source sequence.
 */
export class MapProcessor extends BaseProcessor {
  /**
   * Creates a new MapProcessor instance.
   * @param {number} source - The pointer to the source sequence.
   * @param {number} func - The pointer to the function to apply to each value.
   */
  constructor(source: number, private func: number) {
    super(source);
  }

  /**
   * Retrieves the next transformed value from the sequence.
   * @param {Heap} heap - The heap object for memory management.
   * @param {VM} vm - The virtual machine instance.
   * @returns {number} - The next transformed value, or NIL if the sequence is exhausted.
   */
  next(heap: Heap, vm: VM): number {
    const value = this.getNextValue(heap, vm);
    if (isNIL(value)) {
      return value;
    }

    vm.push(value);
    vm.push(this.func);
    vm.eval();

    return vm.pop();
  }
}

/**
 * Scan processor that maintains an accumulator while processing values.
 * This class extends `BaseProcessor` and applies a function to an accumulator
 * and each value in the source sequence, updating the accumulator with the result.
 */
export class ScanProcessor extends BaseProcessor {
  private accumulator: number;

  /**
   * Creates a new ScanProcessor instance.
   * @param {number} source - The pointer to the source sequence.
   * @param {number} func - The pointer to the function to apply to the accumulator and each value.
   * @param {number} initialValue - The initial value of the accumulator.
   */
  constructor(source: number, private func: number, initialValue: number) {
    super(source);
    this.accumulator = initialValue;
  }

  /**
   * Retrieves the next accumulated value from the sequence.
   * @param {Heap} heap - The heap object for memory management.
   * @param {VM} vm - The virtual machine instance.
   * @returns {number} - The next accumulated value, or NIL if the sequence is exhausted.
   */
  next(heap: Heap, vm: VM): number {
    const value = this.getNextValue(heap, vm);

    if (isNIL(value)) {
      return value;
    }

    vm.push(this.accumulator);
    vm.push(value);
    vm.push(this.func);
    vm.eval();

    this.accumulator = vm.pop();
    return this.accumulator;
  }
}

/**
 * Take processor that only processes the first n values.
 * This class extends `BaseProcessor` and limits the sequence to the first
 * `count` values.
 */
export class TakeProcessor extends BaseProcessor {
  private remaining: number;

  /**
   * Creates a new TakeProcessor instance.
   * @param {number} source - The pointer to the source sequence.
   * @param {number} count - The number of values to take from the source sequence.
   */
  constructor(source: number, count: number) {
    super(source);
    this.remaining = count;
  }

  /**
   * Retrieves the next value from the sequence, limiting it to the first n values.
   * @param {Heap} heap - The heap object for memory management.
   * @param {VM} vm - The virtual machine instance.
   * @returns {number} - The next value within the limit, or NIL if the limit is reached or the sequence is exhausted.
   */
  next(heap: Heap, vm: VM): number {
    if (this.remaining <= 0) {

      return NIL;
    }

    const value = this.getNextValue(heap, vm);
    if (isNIL(value)) {
      return value;
    }

    this.remaining--;
    return value;
  }
}

/**
 * Drop processor that skips the first n values.
 * This class extends `BaseProcessor` and skips the first `count` values
 * from the source sequence.
 */
export class DropProcessor extends BaseProcessor {
  private remaining: number;

  /**
   * Creates a new DropProcessor instance.
   * @param {number} source - The pointer to the source sequence.
   * @param {number} count - The number of values to drop from the source sequence.
   */
  constructor(source: number, count: number) {
    super(source);
    this.remaining = count;
  }

  /**
   * Retrieves the next value from the sequence, skipping the first n values.
   * @param {Heap} heap - The heap object for memory management.
   * @param {VM} vm - The virtual machine instance.
   * @returns {number} - The next value after skipping the specified number of values, or NIL if the sequence is exhausted.
   */
  next(heap: Heap, vm: VM): number {
    while (this.remaining > 0) {

      const value = this.getNextValue(heap, vm);
      if (isNIL(value)) {
        return value;
      }
      this.remaining--;
    }

    return this.getNextValue(heap, vm);
  }
}


/**
 * Chain processor that composes multiple processors.
 * This class extends `BaseProcessor` and applies a chain of processors to the
 * source sequence, where the output of each processor becomes the input to the next.
 */
export class ChainProcessor extends BaseProcessor {

  /**
   * Creates a new ChainProcessor instance.
   * @param {number} source - The pointer to the source sequence.
   * @param {SequenceProcessor[]} processors - An array of `SequenceProcessor` instances to be chained.
   */
  constructor(source: number, private processors: SequenceProcessor[]) {
    super(source);
  }

  /**
   * Retrieves the next value from the sequence after applying the chain of processors.
   * @param {Heap} heap - The heap object for memory management.
   * @param {VM} vm - The virtual machine instance.
   * @returns {number} - The next value after processing through the chain, or NIL if the sequence is exhausted.
   */
  next(heap: Heap, vm: VM): number {
    let value = this.getNextValue(heap, vm);
    if (isNIL(value)) {
      return value;
    }

    for (const processor of this.processors) {
      vm.push(value);
      value = processor.next(heap, vm);
      if (isNIL(value)) {
        return value;
      }
    }

    return value;
  }
}
