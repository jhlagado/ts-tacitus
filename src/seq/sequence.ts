/**
 * @file src/seq/sequence.ts
 * @brief Implements the sequence abstraction in Tacit, providing a way to iterate over data sources and apply transformations.
 *
 * This file defines the core sequence functionality, including sequence creation and the mechanism for advancing through a sequence (seqNext).
 * It supports sequences based on ranges, vectors, strings, and "processor" sequences that apply transformations to other sequences.
 *
 * Architectural Observations:
 * - Sequences are built on top of vectors, using a vector's data block to store sequence metadata.
 * - The `seqNext` function is the central point for sequence iteration, handling different sequence types with a switch statement.
 * - Processors allow for composable sequence transformations like map, filter, take, and drop.
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
import {
  handleProcMap,
  handleProcFilter,
  handleProcSift,
  handleProcTake,
  handleProcDrop,
  handleProcMulti,
  handleProcMultiSource,
} from './processorHandlers';
import { VectorView } from '../heap/vectorView';

export const OFS_TYPE = 0; // headerData[0]
export const OFS_META_COUNT = 1; // headerData[1]
export const OFS_META_START = 2; // headerData[2..]

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
 * This function initializes a sequence by allocating a vector block and writing sequence-specific metadata
 * into it. The metadata includes the sequence type and any additional parameters needed for the sequence.
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
  const headerData: number[] = [sourceType, meta.length];

  // bump every heap-allocated child in `meta`
  for (const m of meta) {
    headerData.push(m);
    if (isHeapAllocated(m)) incRef(heap, m);
  }

  headerData.push(
    sourceType === SeqSourceType.RANGE
      ? meta[0] // start value for range
      : 0
  );

  const vectorTagged = vectorCreate(heap, headerData);

  if (vectorTagged === NIL) return NIL;
  const { value: seqPtr } = fromTaggedValue(vectorTagged);

  return toTaggedValue(seqPtr, true, HeapTag.SEQUENCE);
}

/**
 * @brief Advances a sequence and pushes the next element (if any) onto the VM's stack.
 *
 * This is the core function for sequence iteration. It determines the sequence's type, reads its metadata,
 * and performs the appropriate action to get the next element.  For processor sequences, it may recursively
 * call `seqNext` on underlying sequences and apply transformations.  For other sequence types, it reads
 * from the underlying data source (range, vector, or string) and updates the sequence's internal state
 * (e.g., a cursor or index).
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
export function seqNext(heap: Heap, vm: VM, seq: number): number {
  const { value: seqPtr } = fromTaggedValue(seq);
  const seqv = new SequenceView(heap, seqPtr);

  switch (seqv.type) {
    case SeqSourceType.PROCESSOR: {
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
      const vv = new VectorView(heap, vecPtr);

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
      // meta[0] is the tagged string pointer (Pascal format: [length][chars…])
      const strTV = seqv.meta(0);
      const { value: strAddr } = fromTaggedValue(strTV);
      const i = seqv.cursor;
      // first byte at strAddr is the length
      const len = heap.memory.read8(SEG_STRING, strAddr);

      console.log(`seqNext: string${strAddr} length=${len} cursor=${i} char=`);
      if (i < len) {
        // skip the length byte, then index into the chars
        const ch = heap.memory.read8(SEG_STRING, strAddr + 1 + i);
        vm.push(ch);
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
      const vv = new VectorView(heap, vecPtr);

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
