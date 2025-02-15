import { Heap } from "../data/heap";
import {
  viewGet,
  viewUpdateOffset,
  VIEW_RANK,
  VIEW_SPEC,
  VIEW_OFFSET,
} from "../data/view";
import {
  UNDEF,
  Tag,
  toTaggedValue,
  fromTaggedValue,
  isTaggedValue,
  getTag,
} from "../tagged-value";
import { NULL } from "../constants";

/**
 * seqNext
 * Returns the next slice from the sequence.
 * For a sequence created from a 1D view, the reusable slice view has dimension 0 and is unboxed
 * (using viewGet with an empty index array) to return a scalar.
 * For multidimensional sequences, it returns a sub-view (of rank = parent's rank - 1)
 * along the parent's dimension 0.
 *
 * Before updating the reusable slice view or the sequence block, this function calls
 * heap.copyOnWrite to ensure safe mutation.
 *
 * In the dynamic range case (when the parent view is created via seqFromRange without a shape),
 * the parent's underlying vector pointer equals a special marker. In that case, the next element
 * is computed as the parent's starting value plus the current index.
 *
 * @param heap - The heap instance.
 * @param seqPtr - A tagged pointer to the sequence.
 * @returns The next element (either a tagged view or an unboxed scalar), or UNDEF if the sequence is exhausted.
 */
export function seqNext(heap: Heap, seqPtr: number): number {
  if (!isTaggedValue(seqPtr) || getTag(seqPtr) !== Tag.SEQ) return UNDEF;
  const { value: seqBlock } = fromTaggedValue(Tag.SEQ, seqPtr);
  const totalSlices = heap.memory.read16(seqBlock + 8); // MSEQ_TOTAL offset = 8
  let pos = heap.memory.read16(seqBlock + 6); // MSEQ_MAJOR_POS offset = 6
  if (pos >= totalSlices) return UNDEF;
  const parentBlock = heap.memory.read16(seqBlock + 4); // MSEQ_PARENT_VIEW offset = 4
  // Dynamic range check: if parent's underlying vector equals the special marker.
  if (heap.memory.read16(parentBlock + 4) === 0xffff) {
    const start = heap.memory.read16(parentBlock + 8); // VIEW_OFFSET
    const value = start + pos;
    pos++;
    let safeMseqBlock = heap.copyOnWrite(seqBlock);
    if (safeMseqBlock === NULL) return NULL;
    heap.memory.write16(safeMseqBlock + 6, pos);
    return value;
  }
  let sliceBlock = heap.memory.read16(seqBlock + 10); // MSEQ_SLICE_VIEW offset = 10
  sliceBlock = heap.copyOnWrite(sliceBlock);
  if (sliceBlock === NULL) return NULL;
  heap.memory.write16(seqBlock + 10, sliceBlock);
  const sliceViewPtr = toTaggedValue(Tag.VIEW, sliceBlock);
  const parentBaseOffset = heap.memory.read16(parentBlock + VIEW_OFFSET);
  const stride0 = heap.memory.read16(parentBlock + VIEW_SPEC + 2);
  const newOffset = parentBaseOffset + pos * stride0;
  const updatedSliceView = viewUpdateOffset(heap, sliceViewPtr, newOffset);
  if (updatedSliceView === NULL) return NULL;
  pos++;
  let safeMseqBlock = heap.copyOnWrite(seqBlock);
  if (safeMseqBlock === NULL) return NULL;
  heap.memory.write16(safeMseqBlock + 6, pos);
  const sliceBlockRaw = fromTaggedValue(Tag.VIEW, updatedSliceView).value;
  const sliceRank = heap.memory.read16(sliceBlockRaw + VIEW_RANK);
  if (sliceRank === 0) {
    return viewGet(heap, updatedSliceView, []);
  } else {
    return updatedSliceView;
  }
}

/**
 * seqDup
 * Duplicates the sequence.
 *
 * @param heap - The heap instance.
 * @param seqPtr - A tagged pointer to the sequence.
 * @returns A new tagged sequence pointer, or UNDEF on failure.
 */
export function seqDup(heap: Heap, seqPtr: number): number {
  if (!isTaggedValue(seqPtr)) return UNDEF;
  const { value: seqBlock } = fromTaggedValue(Tag.SEQ, seqPtr);
  const newBlock = heap.cloneBlock(seqBlock);
  if (newBlock === UNDEF) return UNDEF;
  return toTaggedValue(Tag.SEQ, newBlock);
}
