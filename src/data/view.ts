// File: src/view.ts

import { BLOCK_SIZE, Heap } from "./heap";
import {
  toTaggedValue,
  fromTaggedValue,
  isTaggedValue,
  Tag,
  UNDEF,
  getTag,
  isUnDef,
} from "../tagged-value";
import { VEC_SIZE, vectorGet, vectorUpdate } from "./vector";
import { NULL } from "../constants";

export const VIEW_VECTOR = 4;
export const VIEW_RANK = 6;
export const VIEW_OFFSET = 8;
export const VIEW_SPEC = 10;

export const VIEW_SHAPE = 0;
export const VIEW_STRIDES = 2;

export const MAX_DIMENSIONS_VIEW = Math.floor((BLOCK_SIZE - VIEW_SPEC) / 4);

/**
 * Creates a view over a base pointer.
 *
 * The base pointer may be either a tagged vector or a tagged view. The provided offset
 * is added to the base object's offset. The resulting view will have the specified shape.
 *
 * @param {Heap} heap - The heap instance.
 * @param {number} basePtr - The tagged pointer to the base vector or view.
 * @param {number} offset - The offset (in element units) to add to the base's offset.
 * @param {number[]} shape - An array of numbers representing the dimensions of the new view.
 * @returns {number} - A tagged pointer to the newly created view, or UNDEF if creation fails.
 */
export function viewCreate(
  heap: Heap,
  basePtr: number,
  offset: number,
  shape: number[]
): number {
  const dimensions = shape.length;
  if (dimensions === 0 || dimensions > MAX_DIMENSIONS_VIEW) return UNDEF;
  if (!isTaggedValue(basePtr)) return UNDEF;

  let baseVector: number;
  let baseOffset = 0;
  const baseTag = getTag(basePtr);

  if (baseTag === Tag.VECTOR) {
    const { value: vecBlock } = fromTaggedValue(Tag.VECTOR, basePtr);
    baseVector = vecBlock;
  } else if (baseTag === Tag.VIEW) {
    const { value: viewBlock } = fromTaggedValue(Tag.VIEW, basePtr);
    baseVector = heap.memory.read16(viewBlock + VIEW_VECTOR);
    baseOffset = heap.memory.read16(viewBlock + VIEW_OFFSET);
  } else {
    return UNDEF;
  }

  const effectiveOffset = baseOffset + offset;
  const vectorLength = heap.memory.read16(baseVector + VEC_SIZE);

  let totalElements = 1;
  for (let i = 0; i < dimensions; i++) {
    totalElements *= shape[i];
  }
  if (effectiveOffset + totalElements > vectorLength) return UNDEF;

  const viewBlock = heap.malloc(BLOCK_SIZE);
  if (isUnDef(viewBlock)) return UNDEF;

  heap.memory.write16(viewBlock + VIEW_VECTOR, baseVector);
  heap.memory.write16(viewBlock + VIEW_RANK, dimensions);
  heap.memory.write16(viewBlock + VIEW_OFFSET, effectiveOffset);

  let strides = new Array<number>(dimensions);
  strides[dimensions - 1] = 1;
  for (let i = dimensions - 2; i >= 0; i--) {
    strides[i] = strides[i + 1] * shape[i + 1];
  }

  let pos = VIEW_SPEC;
  for (let i = 0; i < dimensions; i++) {
    heap.memory.write16(viewBlock + pos + VIEW_SHAPE, shape[i]);
    heap.memory.write16(viewBlock + pos + VIEW_STRIDES, strides[i]);
    pos += 4;
  }

  return toTaggedValue(Tag.VIEW, viewBlock);
}

/**
 * Retrieves an element from a view at the specified indices.
 *
 * The effective offset is calculated by adding the view's base offset and
 * the contributions of each index scaled by the corresponding stride.
 *
 * @param {Heap} heap - The heap instance.
 * @param {number} viewPtr - The tagged pointer to the view.
 * @param {number[]} indices - An array of indices, one for each dimension of the view.
 * @returns {number} - The retrieved element (as a 32-bit float), or UNDEF if the indices are invalid.
 */
export function viewGet(
  heap: Heap,
  viewPtr: number,
  indices: number[]
): number {
  if (!isTaggedValue(viewPtr)) return UNDEF;
  const { tag, value: viewBlock } = fromTaggedValue(Tag.VIEW, viewPtr);
  if (tag !== Tag.VIEW) return UNDEF;

  const dimensions = heap.memory.read16(viewBlock + VIEW_RANK);
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
  const vectorPtr = heap.memory.read16(viewBlock + VIEW_VECTOR);
  return vectorGet(heap, toTaggedValue(Tag.VECTOR, vectorPtr), offset);
}

/**
 * Updates an element in a view at the specified indices with a new value.
 *
 * The effective offset is computed similarly to viewGet, and the update is performed
 * by delegating to vectorUpdate. If the underlying vector is updated (via copy-on-write),
 * the view's vector pointer is also updated.
 *
 * @param {Heap} heap - The heap instance.
 * @param {number} viewPtr - The tagged pointer to the view.
 * @param {number[]} indices - An array of indices for each dimension.
 * @param {number} value - The new value (32-bit float) to set.
 * @returns {number} - The updated tagged view pointer, or UNDEF if the update fails.
 */
export function viewUpdate(
  heap: Heap,
  viewPtr: number,
  indices: number[],
  value: number
): number {
  if (!isTaggedValue(viewPtr)) return UNDEF;
  const { tag, value: viewBlock } = fromTaggedValue(Tag.VIEW, viewPtr);
  if (tag !== Tag.VIEW) return UNDEF;

  const dimensions = heap.memory.read16(viewBlock + VIEW_RANK);
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
  const vectorPtr = heap.memory.read16(viewBlock + VIEW_VECTOR);
  const newVectorPtr = vectorUpdate(
    heap,
    toTaggedValue(Tag.VECTOR, vectorPtr),
    offset,
    value
  );
  if (isUnDef(newVectorPtr)) return UNDEF;
  heap.memory.write16(
    viewBlock + VIEW_VECTOR,
    fromTaggedValue(Tag.VECTOR, newVectorPtr).value
  );
  return toTaggedValue(Tag.VIEW, viewBlock);
}

/**
 * Updates the view's base offset to a new offset value.
 *
 * This function performs a copy-on-write check before modifying the view's offset.
 * If the view is shared (ref count > 1), it clones the view so that modifications do
 * not affect other references.
 *
 * @param {Heap} heap - The heap instance.
 * @param {number} viewPtr - The tagged pointer to the view.
 * @param {number} newOffset - The new base offset to set in the view.
 * @returns {number} - The updated tagged view pointer, or NULL if cloning fails.
 */
export function viewUpdateOffset(
  heap: Heap,
  viewPtr: number,
  newOffset: number
): number {
  if (!isTaggedValue(viewPtr) || getTag(viewPtr) !== Tag.VIEW) return UNDEF;
  const { value: viewBlock } = fromTaggedValue(Tag.VIEW, viewPtr);
  const safeViewBlock = heap.copyOnWrite(viewBlock);
  if (safeViewBlock === NULL) return NULL;
  heap.memory.write16(safeViewBlock + VIEW_OFFSET, newOffset);
  return toTaggedValue(Tag.VIEW, safeViewBlock);
}
