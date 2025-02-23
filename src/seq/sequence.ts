// src/seq/sequence.ts

import { Heap } from "../core/heap";
import { Tag, toTaggedValue, fromTaggedValue, NIL } from "../core/tagged-value";
import { vectorCreate, VEC_DATA, VEC_SIZE } from "../data/vector";
import { VM } from "../core/vm";

// Sequence source types.
export const SEQ_SRC_RANGE = 1;
export const SEQ_SRC_VECTOR = 2;
export const SEQ_SRC_MULTI_SEQUENCE = 3;
export const SEQ_SRC_STRING = 4;

// Sequence header offsets relative to the vector's data region (which starts at VEC_DATA).
export const SEQ_HEADER_BASE = VEC_DATA; // Base offset (8) in the block.
export const SEQ_TYPE = SEQ_HEADER_BASE; // At offset VEC_DATA: sequence source type.
export const SEQ_META_COUNT = SEQ_HEADER_BASE + 4; // At offset VEC_DATA + 4: number of metadata items.
export const SEQ_META_START = SEQ_HEADER_BASE + 8; // At offset VEC_DATA + 8: metadata array begins here.

/**
 * Creates a sequence and stores its metadata in a vector block.
 */
export function seqCreate(
  heap: Heap,
  sourceType: number,
  meta: number[]
): number {
  let cursorInit = 0;
  if (sourceType === SEQ_SRC_RANGE) {
    cursorInit = meta[0]; // Initialize cursor to start value for ranges
  }

  const headerData = [sourceType, meta.length, ...meta, cursorInit];
  const vectorTagged = vectorCreate(heap, headerData);

  if (vectorTagged === NIL) return NIL;

  const { value: seqPtr } = fromTaggedValue(Tag.BLOCK, vectorTagged);

  return toTaggedValue(Tag.SEQ, seqPtr);
}

/**
 * Advances a sequence and pushes the next element onto the VM's stack.
 * @returns The updated sequence pointer if modified by copy-on-write.
 */
export function seqNext(heap: Heap, vm: VM, seq: number): number {
  let { value: seqPtr } = fromTaggedValue(Tag.SEQ, seq);

  const sourceType = heap.memory.readFloat(seqPtr + SEQ_TYPE);
  const metaCount = heap.memory.readFloat(seqPtr + SEQ_META_COUNT);
  const cursorOffset = SEQ_META_START + metaCount * 4;

  switch (sourceType) {
    case SEQ_SRC_VECTOR: {
      const taggedVecPtr = heap.memory.readFloat(seqPtr + SEQ_META_START);

      const { tag, value: vecPtr } = fromTaggedValue(Tag.BLOCK, taggedVecPtr);

      if (tag !== Tag.BLOCK) {
        console.error("ERROR: Expected BLOCK tag, but got:", tag);
        vm.push(NIL);
        return seq;
      }

      const index = heap.memory.readFloat(seqPtr + cursorOffset);
      const length = heap.memory.read16(vecPtr + VEC_SIZE);

      if (index < length) {
        const item = heap.memory.readFloat(vecPtr + VEC_DATA + index * 4);
        vm.push(item);
        heap.memory.writeFloat(seqPtr + cursorOffset, index + 1);
      } else {
        vm.push(NIL);
      }
      break;
    }
    default:
      vm.push(NIL);
  }

  return seq;
}
