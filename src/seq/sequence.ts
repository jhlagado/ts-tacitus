/**
 * @file src/seq/sequence.ts
 * @brief Implements the sequence abstraction in Tacit, providing a way to iterate over data sources and apply transformations.
 *
 * @detailed_description
 * This file defines the core sequence functionality, including sequence creation and the mechanism
 * for advancing through a sequence (seqNext). It supports sequences based on ranges, vectors, strings,
 * and "processor" sequences that apply transformations to other sequences. Sequences are the primary
 * abstraction for iteration and data transformation in Tacit, providing a unified interface for
 * working with different data sources and applying functional transformations.
 *
 * @memory_management
 * Sequences are heap-allocated objects with reference counting. The seqCreate function increments
 * the reference count of any heap-allocated objects stored in the sequence metadata. When a sequence
 * is no longer needed, its cleanup handler will decrement the reference counts of any objects it holds.
 * Sequences use a copy-on-write approach for any modifications, preserving the immutability of the
 * original sequence while allowing efficient updates.
 *
 * @architectural_observations
 * - Sequences are built on top of vectors, using a vector's data block to store sequence metadata
 * - The sequence metadata includes type, cursor position, and type-specific data
 * - The `seqNext` function is the central point for sequence iteration, handling different sequence
 *   types with a switch statement
 * - Processor sequences allow for composable transformations like map, filter, take, and drop
 * - The design supports lazy evaluation - values are only computed when requested via seqNext
 * - Structural sharing is used for efficient memory usage when sequences are derived from others
 *
 * @related_modules
 * - processor.ts: Factory functions for creating processor sequences
 * - processorHandlers.ts: Handler functions for each processor type
 * - sequenceView.ts: Helper class for accessing sequence metadata
 */

import { SEG_STRING } from '../core/memory';
import { NIL, fromTaggedValue, toTaggedValue, HeapTag } from '../core/tagged';
import { VM } from '../core/vm';
import { vectorCreate } from '../heap/vector';
import { Heap } from '../heap/heap';
import { incRef } from '../heap/heapUtils';
import { isHeapAllocated } from '../core/tagged';

// --- New imports for the refactor ---
import { SequenceView } from './sequenceView';
import { handleProcessorNext } from './processorHandlers';
import { VectorView } from '../heap/vectorView';
// import { prn } from '../core/printer';

export const OFS_TYPE = 0; // headerData[0]
export const OFS_CURSOR = 1; // headerData[1]
export const OFS_META_COUNT = 2; // headerData[2]
export const OFS_META_START = 3; // headerData[3..]

// --- Sequence and Processor constants ---

export enum SeqSourceType {
  RANGE = 1,
  VECTOR = 2,
  STRING = 3,
  PROCESSOR = 4,
  CONSTANT = 5,
  DICT = 6,
}

// Map onto unique opcode values (must be distinct!)
export enum ProcType {
  MAP = 1,
  MULTI = 2,
  SIFT = 3,
  TAKE = 4,
  DROP = 5,
  MULTI_SOURCE = 6,
  FILTER = 7,
  SCAN = 8,
  CHAIN = 9,
}

/**
 * @brief Creates a new sequence and stores its metadata in a vector block on the heap.
 *
 * @detailed_description
 * This function initializes a sequence by allocating a vector block and writing sequence-specific metadata
 * into it. The metadata includes the sequence type and any additional parameters needed for the sequence.
 * The structure of the metadata depends on the sequence type:
 * - For RANGE: meta[0]=start, meta[1]=step, meta[2]=end
 * - For VECTOR: meta[0]=vector pointer
 * - For STRING: meta[0]=string pointer
 * - For PROCESSOR: meta[0]=processor type, meta[1..]=processor-specific data
 * - For CONSTANT: meta[0]=constant value
 * - For DICT: meta[0]=dictionary pointer
 *
 * @memory_management
 * This function increments the reference count of any heap-allocated objects in the meta array.
 * This ensures that objects referenced by the sequence will not be freed while the sequence exists.
 * When the sequence is freed, the cleanup handler will decrement these reference counts.
 *
 * @example
 * // Create a range sequence from 1 to 10 with step 1
 * const rangeSeq = seqCreate(heap, SeqSourceType.RANGE, [1, 1, 10]);
 * 
 * // Create a vector sequence
 * const vectorPtr = vectorCreate(heap, [1, 2, 3, 4, 5]);
 * const vecSeq = seqCreate(heap, SeqSourceType.VECTOR, [vectorPtr]);
 *
 * @param heap The heap on which to allocate the sequence.
 * @param sourceType The type of sequence to create (e.g., range, vector, string, processor). This corresponds
 *                   to one of the SEQ_SRC constants.
 * @param meta An array of numbers representing the metadata for the sequence. The content of this array
 *             depends on the sequence type.  For example, for a range sequence, it might include the
 *             start, step, and end values. For a vector sequence, it would include a pointer to the
 *             underlying vector. For processor sequences, it could include pointers to the source
 *             sequence(s) and transformation functions.
 *
 * @returns A tagged value representing a pointer to the newly created sequence on the heap, or NIL if
 *          allocation fails. The tag is HeapTag.SEQ, indicating that this is a sequence object.
 */
export function seqCreate(heap: Heap, sourceType: number, meta: number[]): number {
  // dont use spread

  const cursor =
    sourceType === SeqSourceType.RANGE
      ? meta[0] // start value for range
      : 0;

  const headerData: number[] = [sourceType, cursor, meta.length];

  // bump every heap-allocated child in `meta`
  for (const m of meta) {
    headerData.push(m);
    if (isHeapAllocated(m)) incRef(heap, m);
  }

  const vectorTagged = vectorCreate(heap, headerData);

  if (vectorTagged === NIL) return NIL;
  const { value: seqPtr } = fromTaggedValue(vectorTagged);

  return toTaggedValue(seqPtr, true, HeapTag.SEQUENCE);
}

/**
 * @brief Advances a sequence and pushes the next element (if any) onto the VM's stack.
 *
 * @detailed_description
 * This is the core function for sequence iteration. It determines the sequence's type, reads its metadata,
 * and performs the appropriate action to get the next element.  For processor sequences, it may recursively
 * call `seqNext` on underlying sequences and apply transformations.  For other sequence types, it reads
 * from the underlying data source (range, vector, or string) and updates the sequence's internal state
 * (e.g., a cursor or index).
 *
 * The function implements lazy evaluation - values are only computed when requested via this function,
 * not when the sequence is created. This allows for efficient processing of potentially infinite sequences
 * and complex transformations.
 *
 * @memory_management
 * This function modifies the sequence's internal state (cursor) but does not change its reference count
 * or create new heap objects. For processor sequences, it may call functions that do allocate heap objects
 * or modify reference counts. The sequence itself is not modified structurally (copy-on-write is not
 * applied within this function), so the returned value is always the same as the input `seq`.
 *
 * @edge_cases
 * - If the sequence is exhausted (no more elements), NIL is pushed onto the stack
 * - For processor sequences, behavior depends on the specific processor type
 * - For DICT sequences, two values are pushed onto the stack: key and value
 *
 * @param heap The heap containing the sequence and any related data.
 * @param vm The virtual machine instance, used for stack manipulation and evaluation of processor functions.
 * @param seq A tagged value representing a pointer to the sequence to advance.
 *
 * @returns The (potentially updated) tagged sequence pointer. In the current implementation, the sequence
 *          pointer is not modified by `seqNext` itself (copy-on-write is not applied within this function),
 *          so the returned value is always the same as the input `seq`. However, the return value is included
 *          for consistency and potential future use.  The function pushes the next element of the sequence onto
 *          the VM's stack, or NIL if the sequence is exhausted.
 */
export function seqNext(vm: VM, seq: number): number {
  const { value: seqPtr } = fromTaggedValue(seq);
  const seqv = new SequenceView(vm.heap, seqPtr);
  switch (seqv.type) {
    case SeqSourceType.PROCESSOR: {
      return handleProcessorNext(vm, seq);
    }
    case SeqSourceType.RANGE: {
      const step = seqv.meta(1);
      const end = seqv.meta(2);
      const cur = seqv.cursor;
      if (cur <= end) {
        vm.push(cur);
        seqv.cursor = cur + step;
      } else {
        vm.push(NIL);
      }
      return seq;
    }

    case SeqSourceType.VECTOR: {
      const taggedVec = seqv.meta(0);
      const { value: vecPtr } = fromTaggedValue(taggedVec);
      const vv = new VectorView(vm.heap, vecPtr);

      const idx = seqv.cursor;
      if (idx < vv.length) {
        vm.push(vv.element(idx));
        seqv.cursor = idx + 1;
      } else {
        vm.push(NIL);
      }
      return seq;
    }

    case SeqSourceType.STRING: {
      const strTV = seqv.meta(0);
      const { value: strAddr } = fromTaggedValue(strTV);
      const len = vm.heap.memory.read8(SEG_STRING, strAddr);
      const i = seqv.cursor;
      const byteValue = vm.heap.memory.read8(SEG_STRING, strAddr + 1 + i);
      console.log(`seqNext debug: STRING sequence at index ${i}, length ${len}, byte value ${byteValue}, string address ${strAddr}, content: ${String.fromCharCode(byteValue)}`);
      if (i < len) {
        vm.push(byteValue);
        seqv.cursor = i + 1;
      } else {
        vm.push(NIL);
      }
      return seq;
    }

    case SeqSourceType.CONSTANT: {
      // This sequence always yields the same constant value.
      const constantValue = seqv.meta(0); // meta[0]
      vm.push(constantValue);
      return seq;
    }

    case SeqSourceType.DICT: {
      // meta[0] = dict pointer
      const dictTaggedPtr = seqv.meta(0);
      const { value: vecPtr } = fromTaggedValue(dictTaggedPtr);
      const vv = new VectorView(vm.heap, vecPtr);

      const pairIdx = seqv.cursor;
      const pairCount = Math.floor(vv.length / 2);

      if (pairIdx < pairCount) {
        const key = vv.element(pairIdx * 2);
        const value = vv.element(pairIdx * 2 + 1);

        vm.push(key);
        vm.push(value);
        seqv.cursor = pairIdx + 1;
      } else {
        vm.push(NIL);
      }
      return seq;
    }

    default:
      vm.push(NIL);
      return seq;
  }
}
