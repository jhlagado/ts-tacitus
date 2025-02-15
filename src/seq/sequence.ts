// File: src/seq/sequence.ts

import { Heap } from "../data/heap";
import { viewGet, viewUpdateOffset, VIEW_RANK, VIEW_SPEC, VIEW_OFFSET } from "../data/view";
import { UNDEF, Tag, toTaggedValue, fromTaggedValue, isTaggedValue, getTag } from "../tagged-value";
import { NULL } from "../constants";
import { ProcessorType } from "./processor";

// Unified Sequence Block Layout offsets (each field is 2 bytes)
export const SEQ_PARENT_VIEW = 4;   // Raw pointer to parent view block
export const SEQ_MAJOR_POS   = 6;   // Current index along parent's dimension 0
export const SEQ_TOTAL       = 8;   // Total number of slices
export const SEQ_SLICE_VIEW  = 10;  // Pointer to reusable slice view
export const SEQ_RANK        = 12;  // Parent view's rank

// Extended processor fields:
export const PROC_FLAG  = 14; // Processor flag
export const PROC_TYPE  = 16; // Processor opcode
export const PROC_PARAM = 18; // Processor parameter
export const PROC_STATE = 20; // Processor state

const RANGE_VIEW_MARKER = 0xffff;

/**
 * seqNext
 * Returns the next element from the sequence.
 *
 * If the sequence block has the processor flag set (PROC_FLAG), processorNext is used.
 * Otherwise, it follows the standard source-sequence logic.
 *
 * @param heap - The heap instance.
 * @param seqPtr - A tagged sequence pointer.
 * @returns The next element (a scalar or tagged view), or UNDEF if exhausted.
 */
export function seqNext(heap: Heap, seqPtr: number): number {
  if (!isTaggedValue(seqPtr) || getTag(seqPtr) !== Tag.SEQ) return UNDEF;
  const { value: seqBlock } = fromTaggedValue(Tag.SEQ, seqPtr);

  // If this is a processor sequence, delegate iteration.
  if (heap.memory.read16(seqBlock + PROC_FLAG) === 1) {
    return processorNext(heap, seqBlock);
  }

  const totalSlices = heap.memory.read16(seqBlock + SEQ_TOTAL);
  let pos = heap.memory.read16(seqBlock + SEQ_MAJOR_POS);
  if (pos >= totalSlices) return UNDEF;
  const parentBlock = heap.memory.read16(seqBlock + SEQ_PARENT_VIEW);

  // Dynamic range case: if parent's underlying vector equals the special marker.
  if (heap.memory.read16(parentBlock + 4) === RANGE_VIEW_MARKER) {
    const start = heap.memory.read16(parentBlock + VIEW_OFFSET);
    const value = start + pos;
    pos++;
    const safeSeqBlock = heap.copyOnWrite(seqBlock);
    if (safeSeqBlock === NULL) return NULL;
    heap.memory.write16(safeSeqBlock + SEQ_MAJOR_POS, pos);
    return value;
  }

  let sliceBlock = heap.memory.read16(seqBlock + SEQ_SLICE_VIEW);
  sliceBlock = heap.copyOnWrite(sliceBlock);
  if (sliceBlock === NULL) return NULL;
  heap.memory.write16(seqBlock + SEQ_SLICE_VIEW, sliceBlock);
  const sliceViewPtr = toTaggedValue(Tag.VIEW, sliceBlock);
  const parentBaseOffset = heap.memory.read16(parentBlock + VIEW_OFFSET);
  const stride0 = heap.memory.read16(parentBlock + VIEW_SPEC + 2);
  const newOffset = parentBaseOffset + pos * stride0;
  const updatedSliceView = viewUpdateOffset(heap, sliceViewPtr, newOffset);
  if (updatedSliceView === NULL) return NULL;
  pos++;
  const safeSeqBlock = heap.copyOnWrite(seqBlock);
  if (safeSeqBlock === NULL) return NULL;
  heap.memory.write16(safeSeqBlock + SEQ_MAJOR_POS, pos);
  const sliceBlockRaw = fromTaggedValue(Tag.VIEW, updatedSliceView).value;
  const sliceRank = heap.memory.read16(sliceBlockRaw + VIEW_RANK);
  if (sliceRank === 0) {
    return viewGet(heap, updatedSliceView, []);
  } else {
    return updatedSliceView;
  }
}

/**
 * processorNext handles iteration for processor sequences.
 * It retrieves the next source element and applies the transformation defined
 * by the processor type.
 *
 * @param heap - The heap instance.
 * @param procBlock - The raw processor sequence block.
 * @returns The next processed element, or UNDEF if exhausted.
 */
function processorNext(heap: Heap, procBlock: number): number {
  const total = heap.memory.read16(procBlock + SEQ_TOTAL);
  let pos = heap.memory.read16(procBlock + SEQ_MAJOR_POS);
  if (pos >= total) return UNDEF;
  
  const srcSeqBlock = heap.memory.read16(procBlock + SEQ_PARENT_VIEW);
  const srcSeq = toTaggedValue(Tag.SEQ, srcSeqBlock);
  let nextVal = seqNext(heap, srcSeq);
  if (nextVal === UNDEF) return UNDEF;
  
  const procType = heap.memory.read16(procBlock + PROC_TYPE);
  const procParam = heap.memory.read16(procBlock + PROC_PARAM);
  let result: number;
  switch (procType) {
    case ProcessorType.MAP:
      result = nextVal * procParam;
      break;
    case ProcessorType.FILTER:
      while (nextVal !== UNDEF && nextVal < procParam) {
        nextVal = seqNext(heap, srcSeq);
      }
      result = nextVal;
      break;
    case ProcessorType.SCAN: {
      let acc = heap.memory.read16(procBlock + PROC_STATE);
      acc += nextVal;
      heap.memory.write16(procBlock + PROC_STATE, acc);
      result = acc;
      break;
    }
    case ProcessorType.DROP: {
      let state = heap.memory.read16(procBlock + PROC_STATE);
      if (state === 0) {
        let drops = procParam;
        while (drops > 0) {
          nextVal = seqNext(heap, srcSeq);
          if (nextVal === UNDEF) break;
          drops--;
        }
        heap.memory.write16(procBlock + PROC_STATE, 1);
      }
      result = nextVal;
      break;
    }
    case ProcessorType.SLICE: {
      // For SLICE, if we're at the very beginning (pos === 0), drop procParam elements.
      if (pos === 0) {
        let drops = procParam;
        while (drops > 0) {
          nextVal = seqNext(heap, srcSeq);
          if (nextVal === UNDEF) break;
          drops--;
        }
      }
      result = nextVal;
      break;
    }
    default:
      result = nextVal;
      break;
  }
  pos++;
  const safeProcBlock = heap.copyOnWrite(procBlock);
  if (safeProcBlock === NULL) return NULL;
  heap.memory.write16(safeProcBlock + SEQ_MAJOR_POS, pos);
  return result;
}

/**
 * seqDup duplicates the sequence.
 *
 * @param heap - The heap instance.
 * @param seqPtr - A tagged sequence pointer.
 * @returns A new tagged sequence pointer, or UNDEF on failure.
 */
export function seqDup(heap: Heap, seqPtr: number): number {
  if (!isTaggedValue(seqPtr)) return UNDEF;
  const { value: seqBlock } = fromTaggedValue(Tag.SEQ, seqPtr);
  const newBlock = heap.cloneBlock(seqBlock);
  if (newBlock === UNDEF) return UNDEF;
  return toTaggedValue(Tag.SEQ, newBlock);
}
