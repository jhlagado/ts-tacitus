// File: src/source.ts

import { Heap } from "../data/heap";
import { vectorCreate } from "../data/vector";
import { viewCreate } from "../data/view";
import { UNDEF, Tag, toTaggedValue, getTag, fromTaggedValue, isTaggedValue } from "../tagged-value";

// Sequence Source Block Layout (for a 1D source sequence):
// Offset 4: underlying view pointer (2 bytes)
// Offset 6: current index (2 bytes)
// Offset 8: total number of elements (2 bytes)
// Offset 10: step size (2 bytes), default is 1

/**
 * Create a sequence from a 1D view.
 * Returns UNDEF if the view is not 1-dimensional.
 */
export function seqFromView(heap: Heap, viewPtr: number): number {
  // Validate that viewPtr is a tagged VIEW.
  if (!isTaggedValue(viewPtr) || getTag(viewPtr) !== Tag.VIEW) return UNDEF;
  const { value: viewBlock } = fromTaggedValue(Tag.VIEW, viewPtr);
  // Read dimension from view (VIEW_DIM is at offset 6).
  const dimensions = heap.memory.read16(viewBlock + 6);
  if (dimensions !== 1) return UNDEF; // Only support 1D views for now.
  
  // The total number of elements is stored as the shape in the first dimension.
  // Our view layout stores the shape for dimension 0 at offset VIEW_SPEC.
  const total = heap.memory.read16(viewBlock + 10);
  
  // Allocate a new block for the sequence.
  const seqBlock = heap.malloc(64); // using BLOCK_SIZE
  if (seqBlock === UNDEF) return UNDEF;
  
  // Write the underlying view pointer.
  // Here we store the raw view block pointer.
  heap.memory.write16(seqBlock + 4, viewBlock);
  // Initialize current index to 0.
  heap.memory.write16(seqBlock + 6, 0);
  // Store the total number of elements.
  heap.memory.write16(seqBlock + 8, total);
  // Set step to 1.
  heap.memory.write16(seqBlock + 10, 1);
  
  return toTaggedValue(Tag.SEQ, seqBlock);
}

/**
 * Create a sequence from a range: [start, start+count).
 * This is implemented by first building a vector from the range,
 * then creating a 1D view covering the entire vector,
 * and finally creating a sequence from that view.
 */
export function seqFromRange(heap: Heap, start: number, count: number): number {
  const data: number[] = [];
  for (let i = 0; i < count; i++) {
    data.push(start + i);
  }
  const vectorPtr = vectorCreate(heap, data);
  if (vectorPtr === UNDEF) return UNDEF;
  
  // Create a 1D view covering the entire vector.
  const viewPtr = viewCreate(heap, vectorPtr, 0, [count]);
  if (viewPtr === UNDEF) return UNDEF;
  
  return seqFromView(heap, viewPtr);
}
