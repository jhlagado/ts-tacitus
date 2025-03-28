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

// Sequence source types.
export const SEQ_SRC_RANGE = 1;
export const SEQ_SRC_VECTOR = 2;
export const SEQ_SRC_STRING = 3;
export const SEQ_SRC_PROCESSOR = 4;

// Processor types
/** @brief Map processor: applies a function to each element. */
export const PROC_MAP = 1;
/** @brief Multi processor: combines elements from multiple sequences. */
export const PROC_MULTI = 2;
/** @brief Filter processor: includes elements based on a condition. */
export const PROC_FILTER = 3;
/** @brief Take processor: limits the sequence to the first n elements. */
export const PROC_TAKE = 4;
/** @brief Drop processor: skips the first n elements of the sequence. */
export const PROC_DROP = 5;
/** @brief Multi Source processor: gets the next value from multiple sequences. */
export const PROC_MULTI_SOURCE = 6;

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

  // Create the underlying vector to hold the sequence metadata.
  const vectorTagged = vectorCreate(heap, headerData);
  if (vectorTagged == NIL) return NIL;

  // Extract the raw pointer to the vector's data block from the tagged value.
  const { value: seqPtr } = fromTaggedValue(vectorTagged);

  // Return a new tagged value representing the sequence, using the vector's data block pointer
  // and the SEQ tag.
  return toTaggedValue(seqPtr, true, HeapTag.SEQ);
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

  const sourceType = heap.memory.readFloat(SEG_HEAP, heap.blockToByteOffset(seqPtr) + SEQ_TYPE);
  const metaCount = heap.memory.readFloat(
    SEG_HEAP,
    heap.blockToByteOffset(seqPtr) + SEQ_META_COUNT
  );
  // Calculate the offset to the cursor, which tracks the current position in the sequence.
  const cursorOffset = SEQ_META_START + metaCount * 4;

  switch (sourceType) {
    case SEQ_SRC_PROCESSOR: {
      const source = heap.memory.readFloat(
        SEG_HEAP,
        heap.blockToByteOffset(seqPtr) + SEQ_META_START
      );
      const procType = heap.memory.readFloat(
        SEG_HEAP,
        heap.blockToByteOffset(seqPtr) + SEQ_META_START + (metaCount - 1) * 4
      );
      // Processors transform other sequences.

      switch (procType) {
        case PROC_MAP: {
          // Get next value from source
          seqNext(heap, vm, source);
          const value = vm.pop();
          if (isNIL(value)) {
            vm.push(NIL);
            return seq;
          }
          // Apply the mapping function to the value.

          const func = heap.memory.readFloat(
            SEG_HEAP,
            heap.blockToByteOffset(seqPtr) + SEQ_META_START + 4
          );
          vm.push(value);
          // The function to be applied to values in the sequence.
          vm.push(func);
          vm.eval();
          return seq;
        }
        case PROC_FILTER: {
          // Get next value from source sequence
          seqNext(heap, vm, source);
          const value = vm.pop();
          if (isNIL(value)) {
            vm.push(NIL);
            return seq;
          }
          // If the value from the source sequence is NIL, push NIL and return.

          // Get next value from mask sequence
          const maskSeq = heap.memory.readFloat(
            SEG_HEAP,
            heap.blockToByteOffset(seqPtr) + SEQ_META_START + 4
          );
          seqNext(heap, vm, maskSeq);
          const maskValue = vm.pop();

          // If the mask value is NIL or falsy, skip the current value.
          if (isNIL(maskValue) || !maskValue) {
            // Skip this value, try next
            return seqNext(heap, vm, seq);
          }

          vm.push(value);
          // Push the value onto the stack if the mask value is truthy.
          return seq;
        }
        case PROC_TAKE: {
          const count = heap.memory.readFloat(
            SEG_HEAP,
            heap.blockToByteOffset(seqPtr) + SEQ_META_START + 4
          );
          const currentCount = heap.memory.readFloat(
            SEG_HEAP,
            heap.blockToByteOffset(seqPtr) + cursorOffset
          );
          // Get the number of elements to take and the current count.

          if (currentCount >= count) {
            vm.push(NIL);
            return seq;
          }

          seqNext(heap, vm, source);
          const value = vm.pop();
          if (isNIL(value)) {
            vm.push(NIL);
            return seq;
          }
          // If the sequence is exhausted, push NIL and return.

          heap.memory.writeFloat(
            SEG_HEAP,
            heap.blockToByteOffset(seqPtr) + cursorOffset,
            currentCount + 1
          );
          vm.push(value);
          // Increment the current count and push the value onto the stack.
          return seq;
        }
        case PROC_DROP: {
          const count = heap.memory.readFloat(
            SEG_HEAP,
            heap.blockToByteOffset(seqPtr) + SEQ_META_START + 4
          );
          const droppedCount = heap.memory.readFloat(
            SEG_HEAP,
            heap.blockToByteOffset(seqPtr) + cursorOffset
          );
          // Get the number of elements to drop and the current dropped count.

          if (droppedCount < count) {
            // Still dropping values
            seqNext(heap, vm, source);
            const value = vm.pop();
            if (isNIL(value)) {
              vm.push(NIL);
              return seq;
            }
            heap.memory.writeFloat(
              SEG_HEAP,
              heap.blockToByteOffset(seqPtr) + cursorOffset,
              droppedCount + 1
            );
            // Increment the dropped count and recursively call `seqNext` to drop the next value.
            return seqNext(heap, vm, seq);
          }

          // Done dropping, return next value
          seqNext(heap, vm, source);
          return seq;
        }
        case PROC_MULTI: {
          // Read number of sequences
          const numSequences = heap.memory.readFloat(
            SEG_HEAP,
            heap.blockToByteOffset(seqPtr) + SEQ_META_START + 4
          );
          // Read the number of sequences to combine.

          // Get next value from each sequence
          for (let i = 0; i < numSequences; i++) {
            const subSeq = heap.memory.readFloat(
              SEG_HEAP,
              heap.blockToByteOffset(seqPtr) + SEQ_META_START + 8 + i * 4
            );
            seqNext(heap, vm, subSeq);
            const value = vm.pop();
            if (isNIL(value)) {
              vm.push(NIL);
              return seq;
            }
            // If any sub-sequence is exhausted, push NIL and return.
          }
          return seq;
        }
        case PROC_MULTI_SOURCE: {
          // Get next value from each sequence
          for (let i = 0; i < metaCount - 1; i++) {
            const subSeq = heap.memory.readFloat(
              SEG_HEAP,
              heap.blockToByteOffset(seqPtr) + SEQ_META_START + i * 4
            );
            seqNext(heap, vm, subSeq);
            const value = vm.pop();
            if (isNIL(value)) {
              vm.push(NIL);
              return seq;
            }
            // If any sub-sequence is exhausted, push NIL and return.
            vm.push(value);
          }
          return seq;
        }
        default:
          // Handle unknown processor types by pushing NIL.
          vm.push(NIL);
          return seq;
      }
    }
    case SEQ_SRC_RANGE: {
      const step = heap.memory.readFloat(
        SEG_HEAP,
        heap.blockToByteOffset(seqPtr) + SEQ_META_START + 4
      ); // meta[1]
      const end = heap.memory.readFloat(
        SEG_HEAP,
        heap.blockToByteOffset(seqPtr) + SEQ_META_START + 8
      ); // meta[2]
      // Read the step and end values for the range.
      const cursor = heap.memory.readFloat(SEG_HEAP, heap.blockToByteOffset(seqPtr) + cursorOffset);
      if (cursor <= end) {
        vm.push(cursor);
        // Increment the cursor for the next iteration.
        heap.memory.writeFloat(
          SEG_HEAP,
          heap.blockToByteOffset(seqPtr) + cursorOffset,
          cursor + step
        );
        // Push the current value (cursor) onto the stack.
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

    default: {
      // Handle unknown sequence types by pushing NIL.
      vm.push(NIL);
    }
  }

  return seq;
}
