import { Heap } from "../data/heap";
import {
  viewCreate,
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
import { vectorCreate, VEC_SIZE } from "../data/vector";

const BLOCK_SIZE = 64;
const RANGE_VIEW_MARKER = 0xffff;

/**
 * seqFromView
 * Creates a unified sequence from any view.
 * The sequence block stores the parent's raw view pointer, current index,
 * total number of slices (from parent's dimension 0), a pointer to a reusable
 * slice view, and the parent's rank.
 *
 * @param heap - The heap instance.
 * @param viewPtr - A tagged pointer to the parent view.
 * @returns A tagged sequence pointer, or UNDEF on failure.
 */
export function seqFromView(heap: Heap, viewPtr: number): number {
  if (!isTaggedValue(viewPtr) || getTag(viewPtr) !== Tag.VIEW) return UNDEF;
  const { value: parentBlock } = fromTaggedValue(Tag.VIEW, viewPtr);
  const parentRank = heap.memory.read16(parentBlock + VIEW_RANK);
  let totalSlices = heap.memory.read16(parentBlock + VIEW_SPEC);
  const seqBlock = heap.malloc(BLOCK_SIZE);
  if (seqBlock === UNDEF) return UNDEF;
  heap.memory.write16(seqBlock + 4, parentBlock); // MSEQ_PARENT_VIEW offset = 4
  heap.memory.write16(seqBlock + 6, 0); // MSEQ_MAJOR_POS offset = 6
  heap.memory.write16(seqBlock + 8, totalSlices); // MSEQ_TOTAL offset = 8
  heap.memory.write16(seqBlock + 12, parentRank); // MSEQ_RANK offset = 12
  const sliceViewTagged = createSliceView(heap, viewPtr);
  if (sliceViewTagged === UNDEF) return UNDEF;
  const { value: sliceBlock } = fromTaggedValue(Tag.VIEW, sliceViewTagged);
  heap.memory.write16(seqBlock + 10, sliceBlock); // MSEQ_SLICE_VIEW offset = 10
  return toTaggedValue(Tag.SEQ, seqBlock);
}

/**
 * createSliceView
 * Creates a reusable slice view from a parent view.
 * For a parent view of rank 1, the slice view is created with dimension 0 (so that it unboxes to a scalar).
 * For a parent view of rank ≥ 2, the slice view’s rank is (parentRank – 1) and its shape and stride
 * are copied from the parent's dimensions 1..(parentRank–1).
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
    // For a 1D parent, create a slice view with dimension 0.
    heap.memory.write16(sliceBlock + VIEW_RANK, 0);
    heap.memory.write16(sliceBlock + VIEW_SPEC, 0);
    heap.memory.write16(sliceBlock + VIEW_SPEC + 2, 1);
  } else {
    const sliceRank = parentRank - 1;
    heap.memory.write16(sliceBlock + VIEW_RANK, sliceRank);
    let parentShapeOffset = VIEW_SPEC + 4; // Skip parent's dimension 0.
    let sliceShapeOffset = VIEW_SPEC; // Corresponds to parent's dimension 1.
    for (let i = 1; i < parentRank; i++) {
      const shapeVal = heap.memory.read16(parentBlock + parentShapeOffset);
      heap.memory.write16(sliceBlock + sliceShapeOffset, shapeVal);
      const strideVal = heap.memory.read16(parentBlock + parentShapeOffset + 2);
      heap.memory.write16(sliceBlock + sliceShapeOffset + 2, strideVal);
      parentShapeOffset += 4;
      sliceShapeOffset += 4;
    }
  }
  return toTaggedValue(Tag.VIEW, sliceBlock);
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
  const { value: vecBlock } = fromTaggedValue(Tag.VECTOR, vectorPtr);
  const len = heap.memory.read16(vecBlock + VEC_SIZE);
  const viewPtr = viewCreate(heap, vectorPtr, 0, [len]);
  if (viewPtr === UNDEF) return UNDEF;
  return seqFromView(heap, viewPtr);
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
    return seqFromView(heap, viewPtr);
  } else {
    const rangeView = createDynamicRangeView(heap, start);
    if (rangeView === UNDEF) return UNDEF;
    const seqPtr = seqFromView(heap, rangeView);
    if (seqPtr === UNDEF) return UNDEF;
    const { value: seqBlock } = fromTaggedValue(Tag.SEQ, seqPtr);
    heap.memory.write16(seqBlock + 8, count);
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
