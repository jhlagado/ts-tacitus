// File: src/view.ts

import { BLOCK_SIZE, Heap } from "./heap";
import {
  toTaggedValue,
  fromTaggedValue,
  isTaggedValue,
  Tag,
  UNDEF,
  getTag,
} from "../tagged-value";
import { vectorGet, vectorUpdate } from "./vector";

// ----------------------------------------------------------------------
// View Block Layout Constants
//
// The view block is laid out as follows:
//   +------------------------------+
//   | VIEW_VECTOR (2 bytes)        |  // Pointer to underlying vector block
//   +------------------------------+
//   | VIEW_DIM (2 bytes)           |  // Number of dimensions
//   +------------------------------+
//   | VIEW_OFFSET (2 bytes)        |  // Base offset (in element units)
//   +------------------------------+
//   | VIEW_SPEC (remaining bytes)  |  // For each dimension: 2 bytes for shape,
//   |                              |     then 2 bytes for stride.
//   +------------------------------+
//
// We define per-dimension offsets:
export const VIEW_VECTOR = 4; // at offset 4: underlying vector pointer (2 bytes)
export const VIEW_DIM = 6; // at offset 6: number of dimensions (2 bytes)
export const VIEW_OFFSET = 8; // at offset 8: base offset into the vector (2 bytes)
export const VIEW_SPEC = 10; // from offset 10: shape/stride data

// For each dimension, we use 4 bytes: 2 for shape, 2 for stride.
export const VIEW_SHAPE = 0; // offset within each 4-byte group for shape
export const VIEW_STRIDES = 2; // offset for stride

// Maximum dimensions a view can support (based on BLOCK_SIZE)
export const MAX_DIMENSIONS_VIEW = Math.floor((BLOCK_SIZE - VIEW_SPEC) / 4);

// ----------------------------------------------------------------------
// viewCreate
//
// Create a view over a base pointer. The base pointer can be either a
// vector (Tag.VECTOR) or a view (Tag.VIEW). 'offset' is added to the base's
// offset (if any), and 'shape' specifies the new dimensions.
// ----------------------------------------------------------------------
export function viewCreate(
  heap: Heap,
  basePtr: number,
  offset: number,
  shape: number[]
): number {
  const dimensions = shape.length;
  if (dimensions > MAX_DIMENSIONS_VIEW) return UNDEF;

  // Validate that basePtr is a properly tagged value
  if (!isTaggedValue(basePtr)) return UNDEF;

  let baseVector: number;
  let baseOffset = 0;
  const baseTag = getTag(basePtr);

  if (baseTag === Tag.VECTOR) {
    // Base is a vector.
    const { value: vecBlock } = fromTaggedValue(Tag.VECTOR, basePtr);
    baseVector = heap.memory.read16(vecBlock + 0);
  } else if (baseTag === Tag.VIEW) {
    // Base is a view; extract its underlying vector and offset.
    const { value: viewBlock } = fromTaggedValue(Tag.VIEW, basePtr);
    baseVector = heap.memory.read16(viewBlock + VIEW_VECTOR);
    baseOffset = heap.memory.read16(viewBlock + VIEW_OFFSET);
  } else {
    return UNDEF;
  }

  // Compute the effective offset.
  const effectiveOffset = baseOffset + offset;

  // Allocate memory for the view.
  const viewBlock = heap.malloc(BLOCK_SIZE);
  if (viewBlock === UNDEF) return UNDEF;

  // Initialize the view structure.
  heap.memory.write16(viewBlock + VIEW_VECTOR, baseVector);
  heap.memory.write16(viewBlock + VIEW_DIM, dimensions);
  heap.memory.write16(viewBlock + VIEW_OFFSET, effectiveOffset);

  // Compute row-major strides.
  let strides = new Array<number>(dimensions);
  strides[dimensions - 1] = 1;
  for (let i = dimensions - 2; i >= 0; i--) {
    strides[i] = strides[i + 1] * shape[i + 1];
  }

  // Store shape and stride information.
  let pos = VIEW_SPEC;
  for (let i = 0; i < dimensions; i++) {
    heap.memory.write16(viewBlock + pos + VIEW_SHAPE, shape[i]);
    heap.memory.write16(viewBlock + pos + VIEW_STRIDES, strides[i]);
    pos += 4;
  }

  return toTaggedValue(Tag.VIEW, viewBlock);
}

// ----------------------------------------------------------------------
// viewGet
//
// Retrieves an element from a view given an array of indices. It calculates
// an effective offset by adding the view's base offset and the contributions
// from each index (using the view's strides).
// ----------------------------------------------------------------------
export function viewGet(
  heap: Heap,
  viewPtr: number,
  indices: number[]
): number {
  if (!isTaggedValue(viewPtr)) return UNDEF;
  const { tag, value: viewBlock } = fromTaggedValue(Tag.VIEW, viewPtr);
  if (tag !== Tag.VIEW) return UNDEF;

  const dimensions = heap.memory.read16(viewBlock + VIEW_DIM);
  if (indices.length !== dimensions) return UNDEF;

  // Start with the view's base offset.
  let offset = heap.memory.read16(viewBlock + VIEW_OFFSET);

  // Add contributions from each dimension.
  for (let i = 0; i < dimensions; i++) {
    const dimShape = heap.memory.read16(
      viewBlock + VIEW_SPEC + i * 4 + VIEW_SHAPE
    );
    const dimStride = heap.memory.read16(
      viewBlock + VIEW_SPEC + i * 4 + VIEW_STRIDES
    );
    if (indices[i] < 0 || indices[i] >= dimShape) return UNDEF;
    offset += indices[i] * dimStride;
  }

  // Retrieve the underlying vector pointer.
  const vectorPtr = heap.memory.read16(viewBlock + VIEW_VECTOR);
  // Delegate to vectorGet to fetch the element at the computed offset.
  return vectorGet(heap, toTaggedValue(Tag.VECTOR, vectorPtr), offset);
}

// ----------------------------------------------------------------------
// viewUpdate
//
// Updates an element in a view at the specified indices with a new value.
// It computes the effective offset similarly to viewGet, then delegates the
// update to vectorUpdate.
// ----------------------------------------------------------------------
export function viewUpdate(
  heap: Heap,
  viewPtr: number,
  indices: number[],
  value: number
): number {
  if (!isTaggedValue(viewPtr)) return UNDEF;
  const { tag, value: viewBlock } = fromTaggedValue(Tag.VIEW, viewPtr);
  if (tag !== Tag.VIEW) return UNDEF;

  const dimensions = heap.memory.read16(viewBlock + VIEW_DIM);
  if (indices.length !== dimensions) return UNDEF;

  let offset = heap.memory.read16(viewBlock + VIEW_OFFSET);
  for (let i = 0; i < dimensions; i++) {
    const dimShape = heap.memory.read16(
      viewBlock + VIEW_SPEC + i * 4 + VIEW_SHAPE
    );
    const dimStride = heap.memory.read16(
      viewBlock + VIEW_SPEC + i * 4 + VIEW_STRIDES
    );
    if (indices[i] < 0 || indices[i] >= dimShape) return UNDEF;
    offset += indices[i] * dimStride;
  }

  // Retrieve the underlying vector pointer.
  const vectorPtr = heap.memory.read16(viewBlock + VIEW_VECTOR);
  // Perform the update using vectorUpdate.
  const newVectorPtr = vectorUpdate(
    heap,
    toTaggedValue(Tag.VECTOR, vectorPtr),
    offset,
    value
  );
  if (newVectorPtr === UNDEF) return UNDEF;

  // In case the vector pointer changed (due to copy-on-write), update it.
  heap.memory.write16(
    viewBlock + VIEW_VECTOR,
    fromTaggedValue(Tag.VECTOR, newVectorPtr).value
  );
  return toTaggedValue(Tag.VIEW, viewBlock);
}
