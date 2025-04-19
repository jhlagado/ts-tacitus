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

import { SEG_HEAP, SEG_STRING } from '../core/memory';
import { NIL, fromTaggedValue, toTaggedValue, HeapTag, isNIL } from '../core/tagged';
import { VM } from '../core/vm';
import { VEC_DATA, vectorCreate, VEC_SIZE } from '../heap/vector';
import { Heap } from '../heap/heap';
import { callTacitFunction } from '../core/interpreter';
import { incRef } from '../heap/heapUtils';
import { isHeapAllocated } from '../core/tagged';

// --- Sequence and Processor constants ---

export const SEQ_SRC_RANGE = 1;
export const SEQ_SRC_VECTOR = 2;
export const SEQ_SRC_STRING = 3;
export const SEQ_SRC_PROCESSOR = 4;
export const SEQ_SRC_CONSTANT = 5;
export const SEQ_SRC_DICT = 6;

// Map onto unique opcode values (must be distinct!)
export const PROC_MAP = 1;
export const PROC_MULTI = 2;
export const PROC_SIFT = 3;
export const PROC_TAKE = 4;
export const PROC_DROP = 5;
export const PROC_MULTI_SOURCE = 6;
export const PROC_FILTER = 7;
export const PROC_SCAN = 8;
export const PROC_CHAIN = 9;

// Sequence header offsets relative to the vector's data region (which starts at VEC_DATA).
/** @brief Base offset for the sequence header within the vector's data. */
export const SEQ_HEADER_BASE = VEC_DATA;
/** @brief Offset to the sequence type within the header. */
export const SEQ_TYPE = SEQ_HEADER_BASE;
/** @brief Offset to the metadata count within the header. */
export const SEQ_META_COUNT = SEQ_HEADER_BASE + 4;
/** @brief Offset to the start of the metadata within the header. */
export const SEQ_META_START = SEQ_HEADER_BASE + 8;

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
  const headerData = [sourceType, meta.length];
  // Note: Do not spread arrays with tagged values directly into `headerData`.  Tagged values are
  // NaN-boxed floats, and spreading them can lead to incorrect conversion to NIL or NaN due to how
  // JavaScript handles NaNs.  Instead, push them individually.
  for (let i = 0; i < meta.length; i++) {
    headerData.push(meta[i]);
  }
  if (sourceType === SEQ_SRC_RANGE) headerData.push(meta[0]);

  // ARC: bump the refcount on every heap‑allocated meta slot
  for (const m of meta) {
    if (isHeapAllocated(m)) {
      incRef(heap, m);
    }
  }

  // Create the underlying vector to hold the sequence metadata.
  const vectorTagged = vectorCreate(heap, headerData);
  if (vectorTagged == NIL) return NIL;

  // Extract the raw pointer to the vector's data block from the tagged value.
  const { value: seqPtr } = fromTaggedValue(vectorTagged);

  // Return a new tagged value representing the sequence, using the vector's data block pointer
  // and the SEQ tag.
  return toTaggedValue(seqPtr, true, HeapTag.SEQUENCE);
}

// Extracted helper functions for processor sequences with explicit types
function handleProcMap(heap: Heap, vm: VM, seq: number, seqPtr: number): number {
  // Get the source sequence and function pointer
  const source: number = heap.memory.readFloat(
    SEG_HEAP,
    heap.blockToByteOffset(seqPtr) + SEQ_META_START
  );
  const func: number = heap.memory.readFloat(
    SEG_HEAP,
    heap.blockToByteOffset(seqPtr) + SEQ_META_START + 4
  );
  const { value: funcPtr } = fromTaggedValue(func);
  seqNext(heap, vm, source);
  const nextValue: number = vm.pop();
  if (isNIL(nextValue)) {
    vm.push(NIL);
    return seq;
  }
  vm.push(nextValue);
  callTacitFunction(funcPtr);
  return seq;
}

function handleProcSift(heap: Heap, vm: VM, seq: number, seqPtr: number): number {
  const source: number = heap.memory.readFloat(
    SEG_HEAP,
    heap.blockToByteOffset(seqPtr) + SEQ_META_START
  );
  seqNext(heap, vm, source);
  const value: number = vm.pop();
  if (isNIL(value)) {
    vm.push(NIL);
    return seq;
  }
  const maskSeq: number = heap.memory.readFloat(
    SEG_HEAP,
    heap.blockToByteOffset(seqPtr) + SEQ_META_START + 4
  );
  seqNext(heap, vm, maskSeq);
  const maskValue: number = vm.pop();
  if (isNIL(maskValue) || !maskValue) {
    // Skip this value, try next
    return seqNext(heap, vm, seq);
  }
  vm.push(value);
  return seq;
}

function handleProcFilter(heap: Heap, vm: VM, seq: number, seqPtr: number): number {
  const source: number = heap.memory.readFloat(
    SEG_HEAP,
    heap.blockToByteOffset(seqPtr) + SEQ_META_START
  );
  seqNext(heap, vm, source);
  const value: number = vm.pop();
  if (isNIL(value)) {
    vm.push(NIL);
    return seq;
  }
  const predicateFunc: number = heap.memory.readFloat(
    SEG_HEAP,
    heap.blockToByteOffset(seqPtr) + SEQ_META_START + 4
  );
  vm.push(value);
  vm.push(predicateFunc);
  vm.eval();
  const predicateResult: number = vm.pop();
  if (isNIL(predicateResult) || !predicateResult) {
    return seqNext(heap, vm, seq);
  }
  vm.push(value);
  return seq;
}

function handleProcTake(
  heap: Heap,
  vm: VM,
  seq: number,
  seqPtr: number,
  cursorOffset: number
): number {
  const count: number = heap.memory.readFloat(
    SEG_HEAP,
    heap.blockToByteOffset(seqPtr) + SEQ_META_START + 4
  );
  const currentCount: number = heap.memory.readFloat(
    SEG_HEAP,
    heap.blockToByteOffset(seqPtr) + cursorOffset
  );
  if (currentCount >= count) {
    vm.push(NIL);
    return seq;
  }
  const source: number = heap.memory.readFloat(
    SEG_HEAP,
    heap.blockToByteOffset(seqPtr) + SEQ_META_START // source pointer
  );
  seqNext(heap, vm, source);
  const value: number = vm.pop();
  if (isNIL(value)) {
    vm.push(NIL);
    return seq;
  }
  heap.memory.writeFloat(SEG_HEAP, heap.blockToByteOffset(seqPtr) + cursorOffset, currentCount + 1);
  vm.push(value);
  return seq;
}

function handleProcDrop(
  heap: Heap,
  vm: VM,
  seq: number,
  seqPtr: number,
  cursorOffset: number
): number {
  const count: number = heap.memory.readFloat(
    SEG_HEAP,
    heap.blockToByteOffset(seqPtr) + SEQ_META_START + 4
  );
  const droppedCount: number = heap.memory.readFloat(
    SEG_HEAP,
    heap.blockToByteOffset(seqPtr) + cursorOffset
  );
  const source: number = heap.memory.readFloat(
    SEG_HEAP,
    heap.blockToByteOffset(seqPtr) + SEQ_META_START
  );
  if (droppedCount < count) {
    seqNext(heap, vm, source);
    const value: number = vm.pop();
    if (isNIL(value)) {
      vm.push(NIL);
      return seq;
    }
    heap.memory.writeFloat(
      SEG_HEAP,
      heap.blockToByteOffset(seqPtr) + cursorOffset,
      droppedCount + 1
    );
    return seqNext(heap, vm, seq);
  }
  seqNext(heap, vm, source);
  return seq;
}

function handleProcMulti(heap: Heap, vm: VM, seq: number, seqPtr: number): number {
  const numSequences: number = heap.memory.readFloat(
    SEG_HEAP,
    heap.blockToByteOffset(seqPtr) + SEQ_META_START + 4
  );
  for (let i = 0; i < numSequences; i++) {
    const subSeq: number = heap.memory.readFloat(
      SEG_HEAP,
      heap.blockToByteOffset(seqPtr) + SEQ_META_START + 8 + i * 4
    );
    seqNext(heap, vm, subSeq);
    const value: number = vm.pop();
    if (isNIL(value)) {
      vm.push(NIL);
      return seq;
    }
  }
  return seq;
}

function handleProcMultiSource(
  heap: Heap,
  vm: VM,
  seq: number,
  seqPtr: number,
  metaCount: number
): number {
  for (let i = 0; i < metaCount - 1; i++) {
    const subSeq: number = heap.memory.readFloat(
      SEG_HEAP,
      heap.blockToByteOffset(seqPtr) + SEQ_META_START + i * 4
    );
    seqNext(heap, vm, subSeq);
    const value: number = vm.pop();
    if (isNIL(value)) {
      vm.push(NIL);
      return seq;
    }
    vm.push(value);
  }
  return seq;
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
  let { value: seqPtr } = fromTaggedValue(seq);
  const sourceType: number = heap.memory.readFloat(
    SEG_HEAP,
    heap.blockToByteOffset(seqPtr) + SEQ_TYPE
  );
  const metaCount: number = heap.memory.readFloat(
    SEG_HEAP,
    heap.blockToByteOffset(seqPtr) + SEQ_META_COUNT
  );
  const cursorOffset: number = SEQ_META_START + metaCount * 4;

  switch (sourceType) {
    case SEQ_SRC_PROCESSOR: {
      const procType: number = heap.memory.readFloat(
        SEG_HEAP,
        heap.blockToByteOffset(seqPtr) + SEQ_META_START + (metaCount - 1) * 4
      );
      switch (procType) {
        case PROC_MAP:
          return handleProcMap(heap, vm, seq, seqPtr);
        case PROC_SIFT:
          return handleProcSift(heap, vm, seq, seqPtr);
        case PROC_FILTER:
          return handleProcFilter(heap, vm, seq, seqPtr);
        case PROC_TAKE:
          return handleProcTake(heap, vm, seq, seqPtr, cursorOffset);
        case PROC_DROP:
          return handleProcDrop(heap, vm, seq, seqPtr, cursorOffset);
        case PROC_MULTI:
          return handleProcMulti(heap, vm, seq, seqPtr);
        case PROC_MULTI_SOURCE:
          return handleProcMultiSource(heap, vm, seq, seqPtr, metaCount);
        default:
          vm.push(NIL);
          return seq;
      }
    }
    case SEQ_SRC_RANGE: {
      const step: number = heap.memory.readFloat(
        SEG_HEAP,
        heap.blockToByteOffset(seqPtr) + SEQ_META_START + 4
      );
      const end: number = heap.memory.readFloat(
        SEG_HEAP,
        heap.blockToByteOffset(seqPtr) + SEQ_META_START + 8
      );
      const cursor: number = heap.memory.readFloat(
        SEG_HEAP,
        heap.blockToByteOffset(seqPtr) + cursorOffset
      );
      if (cursor <= end) {
        vm.push(cursor);
        heap.memory.writeFloat(
          SEG_HEAP,
          heap.blockToByteOffset(seqPtr) + cursorOffset,
          cursor + step
        );
      } else {
        vm.push(NIL);
      }
      break;
    }
    case SEQ_SRC_VECTOR: {
      const taggedVecPtr = heap.memory.readFloat(
        SEG_HEAP,
        heap.blockToByteOffset(seqPtr) + SEQ_META_START
      ); // meta[0]
      // Read the tagged vector pointer and extract the raw pointer.
      const { value: vecPtr } = fromTaggedValue(taggedVecPtr);
      const index = heap.memory.readFloat(SEG_HEAP, heap.blockToByteOffset(seqPtr) + cursorOffset);
      const length = heap.memory.read16(SEG_HEAP, heap.blockToByteOffset(vecPtr) + VEC_SIZE);
      if (index < length) {
        vm.push(
          heap.memory.readFloat(SEG_HEAP, heap.blockToByteOffset(vecPtr) + VEC_DATA + index * 4)
          // Push the element at the current index onto the stack.
        );
        heap.memory.writeFloat(SEG_HEAP, heap.blockToByteOffset(seqPtr) + cursorOffset, index + 1);
      } else {
        vm.push(NIL);
      }
      break;
    }
    case SEQ_SRC_STRING: {
      // Retrieve the tagged string pointer stored in the sequence metadata.
      const taggedStrPtr = heap.memory.readFloat(
        SEG_HEAP,
        heap.blockToByteOffset(seqPtr) + SEQ_META_START
      ); // meta[0]
      // Retrieve the tagged string pointer and extract the raw pointer.
      const { value: strPtr } = fromTaggedValue(taggedStrPtr);

      // Read the current cursor index (stored as a float in the sequence's metadata).
      const index = heap.memory.readFloat(SEG_HEAP, heap.blockToByteOffset(seqPtr) + cursorOffset);

      // Read the string's length (1 byte) from its beginning.
      const length = vm.digest.length(strPtr);

      if (index < length) {
        // Read the character code at the correct offset (skip the length byte).
        const charCode = heap.memory.read8(SEG_STRING, strPtr + 1 + index);
        vm.push(charCode);

        // Increment the cursor index.
        heap.memory.writeFloat(SEG_HEAP, heap.blockToByteOffset(seqPtr) + cursorOffset, index + 1);
        // Push the character code onto the stack.
      } else {
        // If the index exceeds the string's length, push NIL.
        vm.push(NIL);
      }
      break;
    }
    case SEQ_SRC_CONSTANT: {
      // This sequence always yields the same constant value.
      const constantValue = heap.memory.readFloat(
        SEG_HEAP,
        heap.blockToByteOffset(seqPtr) + SEQ_META_START
      ); // meta[0]
      vm.push(constantValue);
      break;
    }
    case SEQ_SRC_DICT: {
      // Dictionary sequence yields key-value pairs.
      const dictTaggedPtr = heap.memory.readFloat(
        SEG_HEAP,
        heap.blockToByteOffset(seqPtr) + SEQ_META_START
      ); // meta[0] is the dict tagged pointer
      const index = heap.memory.readFloat(
        SEG_HEAP,
        heap.blockToByteOffset(seqPtr) + SEQ_META_START + 4
      ); // meta[1] is the current PAIR index

      // A dict is a vector tagged as DICT. Get the underlying vector pointer and length.
      const { value: vecPtr } = fromTaggedValue(dictTaggedPtr);
      const vectorLength = heap.memory.read16(SEG_HEAP, heap.blockToByteOffset(vecPtr) + VEC_SIZE);
      const numPairs = vectorLength / 2;

      if (index < numPairs) {
        // Calculate offsets within the underlying vector
        const keyOffset = index * 2;
        const valueOffset = index * 2 + 1;

        // Read key and value using vector access (treating dict as vector)
        const key = heap.memory.readFloat(
          SEG_HEAP,
          heap.blockToByteOffset(vecPtr) + VEC_DATA + keyOffset * 4
        );
        const value = heap.memory.readFloat(
          SEG_HEAP,
          heap.blockToByteOffset(vecPtr) + VEC_DATA + valueOffset * 4
        );

        vm.push(key); // Push key first
        vm.push(value); // Push value second

        // Increment PAIR index for next iteration
        heap.memory.writeFloat(
          SEG_HEAP,
          heap.blockToByteOffset(seqPtr) + SEQ_META_START + 4,
          index + 1
        );
      } else {
        vm.push(NIL); // End of dictionary
      }
      break;
    }
    default: {
      // Handle unknown sequence types by pushing NIL.
      vm.push(NIL);
    }
  }

  return seq;
}
