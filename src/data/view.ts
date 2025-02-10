// File: src/view.ts

import { BLOCK_SIZE, Heap } from "./heap";
import {
  toTaggedValue,
  fromTaggedValue,
  isTaggedValue,
  Tag,
  UNDEF,
} from "../tagged-value";
import { vectorGet, vectorUpdate } from "./vector";

// -------------------------------------------------------------------
// Define offsets in the view block.
// We’re reusing much of the array’s layout, with an extra field for offset.
// -------------------------------------------------------------------
export const VIEW_VECTOR = 4; // 2 bytes for pointer to vector (from base array)
export const VIEW_DIM = 6; // 2 bytes for number of dimensions
export const VIEW_OFFSET = 8; // 2 bytes for the base offset into the vector
export const VIEW_SPEC = 10; // Start of shape and stride data

// In our view, each dimension has 4 bytes of metadata:
// 2 bytes for the shape and 2 bytes for the stride.
export const VIEW_SHAPE = 0; // Offset within each 4-byte group for shape
export const VIEW_STRIDES = 2; // Offset for stride

export const MAX_DIMENSIONS_VIEW = (BLOCK_SIZE - VIEW_SPEC) / 4;

// -------------------------------------------------------------------
// viewCreate
//
// Create a view given a base array pointer, a base offset (in elements),
// and a new shape (the view's shape).
//
// This function copies the underlying vector pointer from the base array,
// sets the view's dimensions and offset, and writes the shape and computed
// strides into the view block.
// -------------------------------------------------------------------
export function viewCreate(
  heap: Heap,
  baseArrayPtr: number,
  offset: number,
  shape: number[]
): number {
  const dimensions = shape.length;
  if (dimensions > MAX_DIMENSIONS_VIEW) return UNDEF;

  // Retrieve the base array block.
  const { tag: baseTag, value: baseBlock } = fromTaggedValue(
    Tag.ARRAY,
    baseArrayPtr
  );
  if (baseTag !== Tag.ARRAY) return UNDEF;

  // Get the underlying vector pointer from the base array.
  // (The array layout is assumed to have its vector pointer stored at ARR_VECTOR.)
  const baseVector = heap.memory.read16(baseBlock + 4);

  // Allocate a view block.
  const viewBlock = heap.malloc(BLOCK_SIZE);
  if (viewBlock === UNDEF) return UNDEF;

  // Write metadata:
  // - Copy the vector pointer.
  // - Write the number of dimensions.
  // - Write the base offset.
  heap.memory.write16(viewBlock + VIEW_VECTOR, baseVector);
  heap.memory.write16(viewBlock + VIEW_DIM, dimensions);
  heap.memory.write16(viewBlock + VIEW_OFFSET, offset);

  // Compute strides in row‑major order.
  // For a view, the stride for the last dimension is 1.
  // For each preceding dimension, stride = (stride of next dimension) * (size of next dimension).
  let strides = new Array<number>(dimensions);
  strides[dimensions - 1] = 1;
  for (let i = dimensions - 2; i >= 0; i--) {
    strides[i] = strides[i + 1] * shape[i + 1];
  }

  // Write the shape and strides into the view block, starting at VIEW_SPEC.
  let pos = VIEW_SPEC;
  for (let i = 0; i < dimensions; i++) {
    heap.memory.write16(viewBlock + pos + VIEW_SHAPE, shape[i]);
    heap.memory.write16(viewBlock + pos + VIEW_STRIDES, strides[i]);
    pos += 4;
  }

  // Tag the view block as a view.
  return toTaggedValue(Tag.VIEW, viewBlock);
}

// -------------------------------------------------------------------
// viewGet
//
// Retrieves an element from a view given an array of indices.
// It computes an effective offset as the sum of the view's base offset and
// the offset computed from the view's shape and strides.
// -------------------------------------------------------------------
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

  // Start with the view's stored base offset.
  let offset = heap.memory.read16(viewBlock + VIEW_OFFSET);

  // For each dimension, validate the index and add its contribution.
  for (let i = 0; i < dimensions; i++) {
    const shape = heap.memory.read16(
      viewBlock + VIEW_SPEC + i * 4 + VIEW_SHAPE
    );
    const stride = heap.memory.read16(
      viewBlock + VIEW_SPEC + i * 4 + VIEW_STRIDES
    );
    if (indices[i] < 0 || indices[i] >= shape) return UNDEF;
    offset += indices[i] * stride;
  }

  // Retrieve the underlying vector pointer.
  const vectorPtr = heap.memory.read16(viewBlock + VIEW_VECTOR);
  // Use vectorGet to fetch the element at the computed offset.
  return vectorGet(heap, toTaggedValue(Tag.VECTOR, vectorPtr), offset);
}

// -------------------------------------------------------------------
// viewUpdate
//
// Updates an element in a view at the given indices with a new value.
// It computes the effective offset and uses vectorUpdate to perform the update.
// -------------------------------------------------------------------
export function viewUpdate(
  heap: Heap,
  viewPtr: number,
  indices: number[],
  value: number
): number {
  if (!isTaggedValue(viewPtr)) return UNDEF;
  let { tag, value: viewBlock } = fromTaggedValue(Tag.VIEW, viewPtr);
  if (tag !== Tag.VIEW) return UNDEF;

  const dimensions = heap.memory.read16(viewBlock + VIEW_DIM);
  if (indices.length !== dimensions) return UNDEF;

  let offset = heap.memory.read16(viewBlock + VIEW_OFFSET);
  for (let i = 0; i < dimensions; i++) {
    const shape = heap.memory.read16(
      viewBlock + VIEW_SPEC + i * 4 + VIEW_SHAPE
    );
    const stride = heap.memory.read16(
      viewBlock + VIEW_SPEC + i * 4 + VIEW_STRIDES
    );
    if (indices[i] < 0 || indices[i] >= shape) return UNDEF;
    offset += indices[i] * stride;
  }

  // Get the underlying vector pointer.
  const vectorPtr = heap.memory.read16(viewBlock + VIEW_VECTOR);
  // Update the underlying vector.
  const newVectorPtr = vectorUpdate(
    heap,
    toTaggedValue(Tag.VECTOR, vectorPtr),
    offset,
    value
  );
  if (newVectorPtr === UNDEF) return UNDEF;

  // Update the view's vector pointer if necessary (e.g., due to copy-on-write).
  heap.memory.write16(
    viewBlock + VIEW_VECTOR,
    fromTaggedValue(Tag.VECTOR, newVectorPtr).value
  );
  return toTaggedValue(Tag.VIEW, viewBlock);
}
