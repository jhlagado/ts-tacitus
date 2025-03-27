// In src/seq/sequence.ts

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
export const PROC_MAP = 1;
export const PROC_MULTI = 2;
export const PROC_FILTER = 3;
export const PROC_TAKE = 4;
export const PROC_DROP = 5;
export const PROC_MULTI_SOURCE = 6;

// Sequence header offsets relative to the vector's data region (which starts at VEC_DATA).
export const SEQ_HEADER_BASE = VEC_DATA;
export const SEQ_TYPE = SEQ_HEADER_BASE;
export const SEQ_META_COUNT = SEQ_HEADER_BASE + 4;
export const SEQ_META_START = SEQ_HEADER_BASE + 8;

/**
 * Creates a sequence and stores its metadata in a vector block.
 */
export function seqCreate(heap: Heap, sourceType: number, meta: number[]): number {
  const headerData = [sourceType, meta.length];
  // do not spread arrays with tagged values, they will be cannonised to NIL or NaN
  for (let i = 0; i < meta.length; i++) {
    headerData.push(meta[i]);
  }
  if (sourceType === SEQ_SRC_RANGE) headerData.push(meta[0]);
  const vectorTagged = vectorCreate(heap, headerData);
  if (vectorTagged == NIL) return NIL;
  const { value: seqPtr } = fromTaggedValue(vectorTagged);
  return toTaggedValue(seqPtr, true, HeapTag.SEQ);
}

/**
 * Advances a sequence and pushes the next element onto the VM's stack.
 * @returns The updated sequence pointer if modified by copy-on-write.
 */
export function seqNext(heap: Heap, vm: VM, seq: number): number {
  let { value: seqPtr } = fromTaggedValue(seq);

  const sourceType = heap.memory.readFloat(SEG_HEAP, heap.blockToByteOffset(seqPtr) + SEQ_TYPE);
  const metaCount = heap.memory.readFloat(
    SEG_HEAP,
    heap.blockToByteOffset(seqPtr) + SEQ_META_COUNT
  );
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

      switch (procType) {
        case PROC_MAP: {
          // Get next value from source
          seqNext(heap, vm, source);
          const value = vm.pop();
          if (isNIL(value)) {
            vm.push(NIL);
            return seq;
          }

          const func = heap.memory.readFloat(
            SEG_HEAP,
            heap.blockToByteOffset(seqPtr) + SEQ_META_START + 4
          );
          vm.push(value);
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

          // Get next value from mask sequence
          const maskSeq = heap.memory.readFloat(
            SEG_HEAP,
            heap.blockToByteOffset(seqPtr) + SEQ_META_START + 4
          );
          seqNext(heap, vm, maskSeq);
          const maskValue = vm.pop();

          if (isNIL(maskValue) || !maskValue) {
            // Skip this value, try next
            return seqNext(heap, vm, seq);
          }

          vm.push(value);
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

          heap.memory.writeFloat(
            SEG_HEAP,
            heap.blockToByteOffset(seqPtr) + cursorOffset,
            currentCount + 1
          );
          vm.push(value);
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
            vm.push(value);
          }
          return seq;
        }
        default:
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
      const cursor = heap.memory.readFloat(SEG_HEAP, heap.blockToByteOffset(seqPtr) + cursorOffset);
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
      const { value: vecPtr } = fromTaggedValue(taggedVecPtr);
      const index = heap.memory.readFloat(SEG_HEAP, heap.blockToByteOffset(seqPtr) + cursorOffset);
      const length = heap.memory.read16(SEG_HEAP, heap.blockToByteOffset(vecPtr) + VEC_SIZE);
      if (index < length) {
        vm.push(
          heap.memory.readFloat(SEG_HEAP, heap.blockToByteOffset(vecPtr) + VEC_DATA + index * 4)
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
      } else {
        // If the index exceeds the string's length, push NIL.
        vm.push(NIL);
      }
      break;
    }

    default:
      vm.push(NIL);
  }

  return seq;
}
