import { Heap } from "../data/heap";
import { vectorCreate } from "../data/vector";
import { viewCreate } from "../data/view";
import {
  UNDEF,
  Tag,
  toTaggedValue,
  getTag,
  fromTaggedValue,
  isTaggedValue,
} from "../tagged-value";

// Sequence Source Block Layout Constants
export const SEQ_VIEW_PTR = 4; // Underlying view pointer (2 bytes)
export const SEQ_INDEX = 6; // Current index (2 bytes)
export const SEQ_TOTAL = 8; // Total number of elements (2 bytes)
export const SEQ_STEP = 10; // Step size (2 bytes), default is 1

// View Block Layout Constants
import { VIEW_DIM, VIEW_SPEC } from "../data/view"; // Start of shape/stride data

/**
 * Create a sequence from a 1D view.
 * Returns UNDEF if the view is not 1-dimensional.
 */
export function seqFromView(heap: Heap, viewPtr: number): number {
  // Validate that viewPtr is a tagged VIEW.
  if (!isTaggedValue(viewPtr) || getTag(viewPtr) !== Tag.VIEW) return UNDEF;
  const { value: viewBlock } = fromTaggedValue(Tag.VIEW, viewPtr);
  // Read dimension from view.
  const dimensions = heap.memory.read16(viewBlock + VIEW_DIM);
  if (dimensions !== 1) return UNDEF; // Only support 1D views for now.

  // The total number of elements is stored as the shape in the first dimension.
  const total = heap.memory.read16(viewBlock + VIEW_SPEC);

  // Allocate a new block for the sequence.
  const seqBlock = heap.malloc(64); // using BLOCK_SIZE
  if (seqBlock === UNDEF) return UNDEF;

  // Write the underlying view pointer.
  heap.memory.write16(seqBlock + SEQ_VIEW_PTR, viewBlock);
  // Initialize current index to 0.
  heap.memory.write16(seqBlock + SEQ_INDEX, 0);
  // Store the total number of elements.
  heap.memory.write16(seqBlock + SEQ_TOTAL, total);
  // Set step to 1.
  heap.memory.write16(seqBlock + SEQ_STEP, 1);

  return toTaggedValue(Tag.SEQ, seqBlock);
}

/**
 * Create a sequence from a range: [start, start+count).
 * This is implemented by first building a vector from the range,
 * then creating a 1D view covering the entire vector,
 * and finally creating a sequence from that view.
 */
export function seqFromRange(heap: Heap, start: number, count: number): number {
  // Validate input
  if (isNaN(start) || isNaN(count) || count < 0) return UNDEF;

  const data: number[] = [];
  for (let i = 0; i < count; i++) {
    data.push(start + i);
  }
  const vectorPtr = vectorCreate(heap, data);
  if (vectorPtr === UNDEF) return UNDEF;

  // Simulate memory allocation failure
  const viewPtr = viewCreate(heap, vectorPtr, 0, [count]);
  if (viewPtr === UNDEF) {
    heap.free(vectorPtr); // Free allocated vector before returning
    return UNDEF;
  }

  return seqFromView(heap, viewPtr);
}
