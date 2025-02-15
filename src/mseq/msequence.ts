// File: src/msequence.ts

import { Heap } from "../data/heap";
import {
  viewCreate,
  viewGet,
  viewUpdateOffset,
  VIEW_RANK,
  VIEW_SPEC,
  VIEW_VECTOR,
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
import { vectorCreate } from "../data/vector";

// Assume BLOCK_SIZE is 64 bytes.
const BLOCK_SIZE = 64;

// Unified Sequence Block Layout (fields are 2 bytes each)
export const MSEQ_PARENT_VIEW = 4; // Raw pointer to parent view block
export const MSEQ_MAJOR_POS = 6; // Current index along parent's dimension 0
export const MSEQ_TOTAL = 8; // Total number of slices (parent's dim0 size, or overridden)
export const MSEQ_SLICE_VIEW = 10; // Raw pointer to reusable slice view block
export const MSEQ_RANK = 12; // Parent view's rank

const RANGE_VIEW_MARKER = 0xffff;

/**
 * mseqFromView
 * Creates a unified sequence from any view.
 * The sequence block stores the parent's raw view pointer, current index,
 * total number of slices (from parent's dimension 0), a pointer to a reusable
 * slice view, and the parent's rank.
 *
 * @param heap - The heap instance.
 * @param viewPtr - A tagged pointer to the parent view.
 * @returns A tagged sequence pointer, or UNDEF on failure.
 */
export function mseqFromView(heap: Heap, viewPtr: number): number {
  if (!isTaggedValue(viewPtr) || getTag(viewPtr) !== Tag.VIEW) return UNDEF;
  const { value: parentBlock } = fromTaggedValue(Tag.VIEW, viewPtr);
  const parentRank = heap.memory.read16(parentBlock + VIEW_RANK);
  let totalSlices = heap.memory.read16(parentBlock + VIEW_SPEC);
  const seqBlock = heap.malloc(BLOCK_SIZE);
  if (seqBlock === UNDEF) return UNDEF;
  heap.memory.write16(seqBlock + MSEQ_PARENT_VIEW, parentBlock);
  heap.memory.write16(seqBlock + MSEQ_MAJOR_POS, 0);
  heap.memory.write16(seqBlock + MSEQ_TOTAL, totalSlices);
  heap.memory.write16(seqBlock + MSEQ_RANK, parentRank);
  const sliceViewTagged = createSliceView(heap, viewPtr);
  if (sliceViewTagged === UNDEF) return UNDEF;
  const { value: sliceBlock } = fromTaggedValue(Tag.VIEW, sliceViewTagged);
  heap.memory.write16(seqBlock + MSEQ_SLICE_VIEW, sliceBlock);
  return toTaggedValue(Tag.SEQ, seqBlock);
}

/**
 * createSliceView
 * Creates a reusable slice view from a parent view.
 * For a parent view of rank 1, the slice view is created with rank 0 (so that it unboxes to a scalar).
 * For a parent view of rank ≥ 2, the slice view’s rank is (parentRank – 1) and its shape is copied
 * from the parent's dimensions 1..(parentRank–1).
 *
 * @param heap - The heap instance.
 * @param parentViewPtr - A tagged pointer to the parent view.
 * @returns A tagged pointer to the newly created slice view, or UNDEF on failure.
 */
function createSliceView(heap: Heap, parentViewPtr: number): number {
  const sliceBlock = heap.malloc(BLOCK_SIZE);
  if (sliceBlock === UNDEF) return UNDEF;
  const { value: parentBlock } = fromTaggedValue(Tag.VIEW, parentViewPtr);
  const parentVector = heap.memory.read16(parentBlock + VIEW_VECTOR);
  const parentBaseOffset = heap.memory.read16(parentBlock + VIEW_OFFSET);
  heap.memory.write16(sliceBlock + VIEW_VECTOR, parentVector);
  heap.memory.write16(sliceBlock + VIEW_OFFSET, parentBaseOffset);
  const parentRank = heap.memory.read16(parentBlock + VIEW_RANK);
  if (parentRank === 1) {
    // For a 1D parent, create a slice view with rank 0.
    heap.memory.write16(sliceBlock + VIEW_RANK, 0);
    heap.memory.write16(sliceBlock + VIEW_SPEC, 0);
    heap.memory.write16(sliceBlock + VIEW_SPEC + 2, 1);
  } else {
    const sliceRank = parentRank - 1;
    heap.memory.write16(sliceBlock + VIEW_RANK, sliceRank);
    let parentShapeOffset = VIEW_SPEC + 4; // Skip parent's dimension 0.
    let sliceShapeOffset = VIEW_SPEC; // Slice view's dim0 corresponds to parent's dim1.
    for (let i = 1; i < parentRank; i++) {
      const dimSize = heap.memory.read16(parentBlock + parentShapeOffset);
      heap.memory.write16(sliceBlock + sliceShapeOffset, dimSize);
      parentShapeOffset += 4;
      sliceShapeOffset += 4;
    }
  }
  return toTaggedValue(Tag.VIEW, sliceBlock);
}

/**
 * mseqNext
 * Returns the next slice from the sequence.
 * For a sequence created from a 1D view, the reusable slice view has rank 0 and is unboxed
 * (using viewGet with an empty index array) to return a scalar.
 * For multidimensional sequences, it returns a sub-view (of rank = parentRank – 1)
 * along the parent's dimension 0.
 *
 * Before updating the reusable slice view or the sequence block, this function calls
 * heap.copyOnWrite to ensure safe mutation.
 *
 * In the dynamic range case (when the parent view is created via seqFromRange without a shape),
 * the parent's underlying vector pointer equals RANGE_VIEW_MARKER. In that case, the next element
 * is computed as the parent's starting value plus the current index.
 *
 * @param heap - The heap instance.
 * @param mseqPtr - A tagged pointer to the sequence.
 * @returns The next element (either a tagged view or an unboxed scalar), or UNDEF if the sequence is exhausted.
 */
export function mseqNext(heap: Heap, mseqPtr: number): number {
  if (!isTaggedValue(mseqPtr) || getTag(mseqPtr) !== Tag.SEQ) return UNDEF;
  const { value: mseqBlock } = fromTaggedValue(Tag.SEQ, mseqPtr);
  const totalSlices = heap.memory.read16(mseqBlock + MSEQ_TOTAL);
  let pos = heap.memory.read16(mseqBlock + MSEQ_MAJOR_POS);
  if (pos >= totalSlices) return UNDEF;
  const parentBlock = heap.memory.read16(mseqBlock + MSEQ_PARENT_VIEW);
  // Dynamic range check: parent's underlying vector equals RANGE_VIEW_MARKER.
  if (heap.memory.read16(parentBlock + VIEW_VECTOR) === RANGE_VIEW_MARKER) {
    const start = heap.memory.read16(parentBlock + VIEW_OFFSET);
    const value = start + pos;
    pos++;
    let safeMseqBlock = heap.copyOnWrite(mseqBlock);
    if (safeMseqBlock === NULL) return NULL;
    heap.memory.write16(safeMseqBlock + MSEQ_MAJOR_POS, pos);
    return value;
  }
  let sliceBlock = heap.memory.read16(mseqBlock + MSEQ_SLICE_VIEW);
  sliceBlock = heap.copyOnWrite(sliceBlock);
  if (sliceBlock === NULL) return NULL;
  heap.memory.write16(mseqBlock + MSEQ_SLICE_VIEW, sliceBlock);
  const sliceViewPtr = toTaggedValue(Tag.VIEW, sliceBlock);
  const parentBaseOffset = heap.memory.read16(parentBlock + VIEW_OFFSET);
  const stride0 = heap.memory.read16(parentBlock + VIEW_SPEC + 2);
  const newOffset = parentBaseOffset + pos * stride0;
  const updatedSliceView = viewUpdateOffset(heap, sliceViewPtr, newOffset);
  if (updatedSliceView === NULL) return NULL;
  pos++;
  let safeMseqBlock = heap.copyOnWrite(mseqBlock);
  if (safeMseqBlock === NULL) return NULL;
  heap.memory.write16(safeMseqBlock + MSEQ_MAJOR_POS, pos);
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

/**
 * seqFromVector
 * Creates a unified sequence from an existing vector.
 *
 * @param heap - The heap instance.
 * @param vectorPtr - A tagged pointer to the vector.
 * @returns A tagged sequence pointer, or UNDEF on failure.
 */
export function seqFromVector(heap: Heap, vectorPtr: number): number {
  if (!isTaggedValue(vectorPtr) || getTag(vectorPtr) !== Tag.VECTOR)
    return UNDEF;
  const len = heap.memory.read16(vectorPtr + 0);
  const viewPtr = viewCreate(heap, vectorPtr, 0, [len]);
  if (viewPtr === UNDEF) return UNDEF;
  return mseqFromView(heap, viewPtr);
}

/**
 * seqFromRange
 * Creates a unified sequence from a range of numbers.
 * If an optional shape is provided, the data is realized into a vector;
 * otherwise, a dynamic range view is created.
 *
 * In the dynamic case, a lazy range view is created with rank 0 (so that each next() unboxes to a scalar)
 * and the sequence block's total-slices field is overridden with the full count.
 *
 * @param heap - The heap instance.
 * @param start - The starting number.
 * @param count - The number of elements.
 * @param shape - Optional shape array.
 * @returns A tagged sequence pointer, or UNDEF on failure.
 */
export function seqFromRange(
  heap: Heap,
  start: number,
  count: number,
  shape?: number[]
): number {
  if (isNaN(start) || isNaN(count) || count < 0) return UNDEF;
  if (shape !== undefined) {
    const totalElements = shape.reduce((a, b) => a * b, 1);
    if (totalElements !== count) return UNDEF;
    const data: number[] = [];
    for (let i = 0; i < count; i++) {
      data.push(start + i);
    }
    const vectorPtr = vectorCreate(heap, data);
    if (vectorPtr === UNDEF) return UNDEF;
    const viewPtr = viewCreate(heap, vectorPtr, 0, shape);
    if (viewPtr === UNDEF) {
      heap.free(vectorPtr);
      return UNDEF;
    }
    return mseqFromView(heap, viewPtr);
  } else {
    const rangeView = createDynamicRangeView(heap, start);
    if (rangeView === UNDEF) return UNDEF;
    const seqPtr = mseqFromView(heap, rangeView);
    if (seqPtr === UNDEF) return UNDEF;
    const { value: seqBlock } = fromTaggedValue(Tag.SEQ, seqPtr);
    heap.memory.write16(seqBlock + MSEQ_TOTAL, count);
    return seqPtr;
  }
}

/**
 * createDynamicRangeView
 * Creates a dynamic range view for lazy range sequences.
 * The view is created with rank 0 so that each next() unboxes to a scalar.
 * The view stores the starting number in VIEW_OFFSET.
 *
 * @param heap - The heap instance.
 * @param start - The starting number.
 * @returns A tagged view pointer, or UNDEF on failure.
 */
function createDynamicRangeView(heap: Heap, start: number): number {
  const viewBlock = heap.malloc(BLOCK_SIZE);
  if (viewBlock === UNDEF) return UNDEF;
  heap.memory.write16(viewBlock + 4, RANGE_VIEW_MARKER);
  heap.memory.write16(viewBlock + VIEW_RANK, 0);
  heap.memory.write16(viewBlock + VIEW_OFFSET, start);
  heap.memory.write16(viewBlock + VIEW_SPEC, 0);
  heap.memory.write16(viewBlock + VIEW_SPEC + 2, 1);
  return toTaggedValue(Tag.VIEW, viewBlock);
}
