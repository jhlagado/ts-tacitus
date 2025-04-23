/**
 * @file src/seq/processorHandlers.ts
 * @brief Implements handler functions for different types of sequence processors.
 * 
 * @detailed_description
 * This file contains the implementation of handler functions for each processor type
 * defined in the ProcType enum. These handlers are called by the seqNext function when
 * advancing a processor sequence. Each handler implements a specific transformation or
 * filtering behavior, such as mapping, filtering, taking, or dropping elements.
 * 
 * @memory_management
 * The handlers modify the sequence's internal state (cursor) but generally do not change
 * reference counts directly. They may call functions that do allocate heap objects or
 * modify reference counts, such as when evaluating Tacit functions. The sequence itself
 * is not modified structurally (copy-on-write is not applied within these handlers).
 * 
 * @architectural_observations
 * - Each processor type has a dedicated handler function that implements its behavior
 * - The handlers use the SequenceView class to access sequence metadata
 * - The handlers often recursively call seqNext on source sequences
 * - The central handleProcessorNext function dispatches to the appropriate handler
 * - This design separates processor creation (in processor.ts) from processor execution
 * 
 * @related_modules
 * - sequence.ts: Core sequence functionality and seqNext implementation
 * - processor.ts: Factory functions for creating processor sequences
 * - sequenceView.ts: Helper class for accessing sequence metadata
 */

import { VM } from '../core/vm';
import { SequenceView } from './sequenceView';
import { NIL, isNIL, fromTaggedValue } from '../core/tagged';
import { callTacitFunction } from '../lang/interpreter';
import { ProcType } from './sequence';
import { prn } from '../core/printer';

/**
 * @brief PROC_MAP: Apply a function to each element of the source sequence.
 *
 * @detailed_description
 * This handler implements the map processor behavior. It advances the source sequence,
 * applies the function to the resulting value, and pushes the result onto the stack.
 * If the source sequence is exhausted (returns NIL), the map processor also returns NIL.
 *
 * @memory_management
 * This function calls callTacitFunction which may allocate heap objects or modify
 * reference counts. The sequence itself is not modified structurally.
 *
 * @edge_cases
 * - If the source sequence returns NIL, NIL is pushed onto the stack
 * - If the function evaluation fails, the behavior depends on the VM error handling
 */
export function handleProcMap(vm: VM, seq: number, seqv: SequenceView): number {
  const source = seqv.meta(1);
  const func = seqv.meta(2);
  const { value: fnPtr } = fromTaggedValue(func);

  // advance child, pop its value
  seqv.next(vm, source);
  const v = vm.pop();
  if (isNIL(v)) {
    vm.push(NIL);
  } else {
    vm.push(v);
    callTacitFunction(fnPtr);
  }
  return seq;
}

/**
 * @brief PROC_SIFT: Keep elements where the corresponding mask sequence value is truthy.
 *
 * @detailed_description
 * This handler implements the sift processor behavior. It advances both the source and
 * mask sequences in lock-step. It only yields values from the source sequence when the
 * corresponding value from the mask sequence is truthy. If either sequence is exhausted
 * (returns NIL), the sift processor also returns NIL.
 *
 * @memory_management
 * This function does not directly allocate heap objects or modify reference counts.
 * The sequence itself is not modified structurally.
 *
 * @edge_cases
 * - If the source sequence returns NIL, NIL is pushed onto the stack
 * - If the mask sequence returns NIL, NIL is pushed onto the stack
 * - If the mask value is falsy, the handler recursively calls seqNext on the processor
 */
export function handleProcSift(vm: VM, seq: number, seqv: SequenceView): number {
  const source = seqv.meta(1);
  const maskSeq = seqv.meta(2);

  seqv.next(vm, source);
  let v = vm.pop();
  if (isNIL(v)) {
    vm.push(NIL);
    return seq;
  }

  seqv.next(vm, maskSeq);
  const m = vm.pop();
  if (isNIL(m) || !m) {
    // skip this element → advance top‑level seq
    return seqv.next(vm, seq);
  }

  vm.push(v);
  return seq;
}

/**
 * @brief PROC_FILTER: Keep elements where the predicate function returns truthy.
 *
 * @detailed_description
 * This handler implements the filter processor behavior. It advances the source sequence,
 * applies the predicate function to the resulting value, and only yields the value if
 * the predicate returns a truthy value. If the source sequence is exhausted (returns NIL),
 * the filter processor also returns NIL.
 *
 * @memory_management
 * This function calls VM.eval() which may allocate heap objects or modify reference counts.
 * The sequence itself is not modified structurally.
 *
 * @edge_cases
 * - If the source sequence returns NIL, NIL is pushed onto the stack
 * - If the predicate returns a falsy value, the handler recursively calls seqNext on the processor
 * - If the predicate evaluation fails, the behavior depends on the VM error handling
 */
export function handleProcFilter(vm: VM, seq: number, seqv: SequenceView): number {
  const source = seqv.meta(1);
  const predicateFunc = seqv.meta(2);

  seqv.next(vm, source);
  let v = vm.pop();
  if (isNIL(v)) {
    vm.push(NIL);
    return seq;
  }

  vm.push(v);
  vm.push(predicateFunc);
  vm.eval();
  const keep = vm.pop();
  if (isNIL(keep) || !keep) {
    // skip → advance top‑level seq
    return seqv.next(vm, seq);
  }

  vm.push(v);
  return seq;
}

/**
 * @brief PROC_TAKE: Take first N elements, then yield NIL forever.
 *
 * @detailed_description
 * This handler implements the take processor behavior. It yields only the first 'count'
 * values from the source sequence, then terminates (returns NIL) regardless of whether
 * the source sequence has more values. It uses the sequence's cursor field to track
 * how many elements have been taken so far.
 *
 * @memory_management
 * This function does not directly allocate heap objects or modify reference counts.
 * It modifies the sequence's cursor field to track progress.
 *
 * @edge_cases
 * - If the cursor reaches or exceeds the limit, NIL is pushed onto the stack
 * - If the source sequence returns NIL before the limit is reached, NIL is pushed onto the stack
 */
export function handleProcTake(vm: VM, seq: number, seqv: SequenceView): number {
  const limit = seqv.meta(2);
  const idx = seqv.cursor;
  prn('limit', limit);

  if (idx >= limit) {
    vm.push(NIL);
    return seq;
  }

  const source = seqv.meta(1);
  seqv.next(vm, source);
  const v = vm.pop();
  if (isNIL(v)) {
    vm.push(NIL);
    return seq;
  }

  seqv.cursor = idx + 1;
  vm.push(v);
  return seq;
}

/**
 * @brief PROC_DROP: Skip first N elements, then yield the rest.
 *
 * @detailed_description
 * This handler implements the drop processor behavior. It skips the first 'count'
 * values from the source sequence, then yields all remaining values. It uses the
 * sequence's cursor field to track how many elements have been dropped so far.
 *
 * @memory_management
 * This function does not directly allocate heap objects or modify reference counts.
 * It modifies the sequence's cursor field to track progress.
 *
 * @edge_cases
 * - During the initial dropping phase, values are discarded without being pushed onto the stack
 * - After dropping the required number of elements, the behavior is equivalent to the source sequence
 */
export function handleProcDrop(vm: VM, seq: number, seqv: SequenceView): number {
  const toDrop = seqv.meta(2);
  let dropped = seqv.cursor;

  while (dropped < toDrop) {
    seqv.next(vm, seqv.meta(1));
    vm.pop(); // discard
    dropped++;
    seqv.cursor = dropped;
  }

  // now yield the next element
  return seqv.next(vm, seqv.meta(1));
}

/**
 * @brief PROC_MULTI: Advance N sub-sequences in lock-step, return NIL if any ends.
 *
 * @detailed_description
 * This handler implements the multi-sequence processor behavior. It advances all source
 * sequences in lock-step and terminates when any of the source sequences is exhausted
 * (returns NIL). This is useful for operations that need to process multiple sequences
 * together, such as zipping or combining sequences.
 *
 * @memory_management
 * This function does not directly allocate heap objects or modify reference counts.
 * The sequence itself is not modified structurally.
 *
 * @edge_cases
 * - If any source sequence returns NIL, NIL is pushed onto the stack
 * - The values from the source sequences are not pushed onto the stack by this handler
 *   (this is different from MULTI_SOURCE which does push the values)
 */
export function handleProcMulti(vm: VM, seq: number, seqv: SequenceView): number {
  const n = seqv.metaCount - 1;
  for (let i = 1; i <= n; i++) {
    const sub = seqv.meta(i);
    seqv.next(vm, sub);
    const v = vm.pop();
    if (isNIL(v)) {
      vm.push(NIL);
      return seq;
    }
  }
  return seq;
}

/**
 * @brief PROC_MULTI_SOURCE: Like MULTI but yields all collected values each step.
 *
 * @detailed_description
 * This handler implements the multi-source processor behavior. It advances all source
 * sequences in lock-step and yields all collected values at each step. It terminates
 * when any of the source sequences is exhausted (returns NIL). Unlike multiSeq which
 * only signals when sequences are consumed, this processor actually yields the values
 * from all sequences at each step.
 *
 * @memory_management
 * This function does not directly allocate heap objects or modify reference counts.
 * The sequence itself is not modified structurally.
 *
 * @edge_cases
 * - If any source sequence returns NIL, NIL is pushed onto the stack
 * - The values from all source sequences are pushed onto the stack in order
 */
export function handleProcMultiSource(vm: VM, seq: number, seqv: SequenceView): number {
  const n = seqv.metaCount - 1;
  for (let i = 1; i <= n; i++) {
    const src = seqv.meta(i);
    seqv.next(vm, src);
    const v = vm.pop();
    if (isNIL(v)) {
      vm.push(NIL);
      return seq;
    }
    vm.push(v);
  }
  return seq;
}

/**
 * @brief Central dispatcher for processor sequence handlers.
 *
 * @detailed_description
 * This function is the central dispatcher for processor sequence handlers. It determines
 * the processor type from the sequence metadata and delegates to the appropriate handler
 * function. This function is called by seqNext when it encounters a processor sequence.
 *
 * @memory_management
 * This function does not directly allocate heap objects or modify reference counts.
 * It delegates to handler functions that may do so.
 *
 * @param vm The virtual machine instance, used for stack manipulation and evaluation.
 * @param seq A tagged value representing a pointer to the processor sequence.
 * @returns The (potentially updated) tagged sequence pointer, typically the same as the input.
 */
export function handleProcessorNext(vm: VM, seq: number) {
  const { value: seqPtr } = fromTaggedValue(seq);
  const seqv = new SequenceView(vm.heap, seqPtr);
  const op = seqv.processorType; // meta[0]
  switch (op) {
    case ProcType.MAP:
      return handleProcMap(vm, seq, seqv);
    case ProcType.FILTER:
      return handleProcFilter(vm, seq, seqv);
    case ProcType.SIFT:
      return handleProcSift(vm, seq, seqv);
    case ProcType.TAKE:
      return handleProcTake(vm, seq, seqv);
    case ProcType.DROP:
      return handleProcDrop(vm, seq, seqv);
    case ProcType.MULTI:
      return handleProcMulti(vm, seq, seqv);
    case ProcType.MULTI_SOURCE:
      return handleProcMultiSource(vm, seq, seqv);
    default:
      vm.push(NIL);
      return seq;
  }
}
