import { Heap } from '../heap/heap';
import { isNIL, NIL } from '../core/tagged';
import { VM } from '../core/vm';
import {
  seqNext,
  seqCreate,
  SEQ_SRC_PROCESSOR,
  PROC_MAP,
  PROC_FILTER,
  PROC_TAKE,
  PROC_DROP,
  PROC_MULTI_SOURCE,
} from './sequence';

/**
 * Creates a map processor sequence that transforms each value using a function
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
 */
export function multiSeq(heap: Heap, sequences: number[]): number {
  return seqCreate(heap, SEQ_SRC_PROCESSOR, [...sequences, PROC_MULTI_SOURCE]);
}

/**
 * Creates a filter processor sequence that only keeps values where corresponding mask value is true
 */
export function filterSeq(heap: Heap, source: number, maskSeq: number): number {
  return seqCreate(heap, SEQ_SRC_PROCESSOR, [source, maskSeq, PROC_FILTER]);
}

/**
 * Creates a take processor sequence that only processes the first n values
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
 */
export function chainSeq(heap: Heap, source: number, processors: number[]): number {
  // Create a processor sequence with:
  // - source sequence
  // - array of processor sequences
  // - processor type (CHAIN)
  return seqCreate(heap, SEQ_SRC_PROCESSOR, [source, ...processors, 6]); // 6 = CHAIN
}

/**
 * Base interface for sequence processors
 */
export interface SequenceProcessor {
  next(heap: Heap, vm: VM): number;
}

/**
 * Base class for all sequence processors that provides common functionality
 */
abstract class BaseProcessor implements SequenceProcessor {
  constructor(protected source: number) {}

  protected getNextValue(heap: Heap, vm: VM): number {
    seqNext(heap, vm, this.source);
    return vm.pop();
  }

  abstract next(heap: Heap, vm: VM): number;
}

/**
 * Filter processor that only keeps values where predicate returns true
 */
export class FilterProcessor extends BaseProcessor {
  constructor(source: number, private predicate: number) {
    super(source);
  }

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
 * Map processor that transforms each value using a function
 */
export class MapProcessor extends BaseProcessor {
  constructor(source: number, private func: number) {
    super(source);
  }

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
 * Scan processor that maintains an accumulator while processing values
 */
export class ScanProcessor extends BaseProcessor {
  private accumulator: number;

  constructor(source: number, private func: number, initialValue: number) {
    super(source);
    this.accumulator = initialValue;
  }

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
 * Take processor that only processes the first n values
 */
export class TakeProcessor extends BaseProcessor {
  private remaining: number;

  constructor(source: number, count: number) {
    super(source);
    this.remaining = count;
  }

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
 * Drop processor that skips the first n values
 */
export class DropProcessor extends BaseProcessor {
  private remaining: number;

  constructor(source: number, count: number) {
    super(source);
    this.remaining = count;
  }

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
 * Chain processor that composes multiple processors
 */
export class ChainProcessor extends BaseProcessor {
  constructor(source: number, private processors: SequenceProcessor[]) {
    super(source);
  }

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
