import { BLOCK_SIZE, Heap } from "./heap";
import {
  fromTaggedValue,
  isTaggedValue,
  Tag,
  toTaggedValue,
  UNDEF,
} from "../tagged-value";
import { vectorCreate, vectorGet, vectorUpdate } from "./vector";

// Define offsets in the array block
export const ARR_VECTOR = 4; // Pointer to vector (2 bytes)
export const ARR_DIM = 6; // Number of dimensions (2 bytes)
export const ARR_SPEC = 8; // Start of shape and stride data

export const ARR_SHAPE = 0; // Shape data (2 bytes per dimension)
export const ARR_STRIDES = 2; // Strides data (2 bytes per dimension)

export const MAX_DIMENSIONS = (BLOCK_SIZE - ARR_SPEC) / 4; // 32-bit floats

/**
 * Creates a new array with the given shape and data.
 * @param heap - The heap instance.
 * @param shape - Shape of the array.
 * @param data - JavaScript array containing initial values.
 * @returns Pointer to the array block.
 */
export function arrayCreate(
  heap: Heap,
  shape: number[],
  data: number[]
): number {
  const dimensions = shape.length;
  if (dimensions > MAX_DIMENSIONS) return UNDEF;

  // Create the vector
  const vectorPtr = vectorCreate(heap, data);
  if (vectorPtr === UNDEF) return UNDEF;

  // Allocate the array block
  const arrayBlock = heap.malloc(BLOCK_SIZE);
  if (arrayBlock === UNDEF) return UNDEF;

  // Write metadata
  heap.memory.write16(
    arrayBlock + ARR_VECTOR,
    fromTaggedValue(Tag.VECTOR, vectorPtr).value
  );
  heap.memory.write16(arrayBlock + ARR_DIM, dimensions);

  // Compute strides in row-major order:
  // For a row-major array, stride for dimension i is the product of shapes of dimensions i+1..n-1
  const strides = new Array<number>(dimensions);
  strides[dimensions - 1] = 1;
  for (let i = dimensions - 2; i >= 0; i--) {
    strides[i] = strides[i + 1] * shape[i + 1];
  }

  // Write shape and strides in the same order as the original shape array
  let offset = ARR_SPEC;
  for (let i = 0; i < dimensions; i++) {
    heap.memory.write16(arrayBlock + offset + ARR_SHAPE, shape[i]);
    heap.memory.write16(arrayBlock + offset + ARR_STRIDES, strides[i]);
    offset += 4;
  }

  return toTaggedValue(Tag.VIEW, arrayBlock);
}

/**
 * Retrieves an element from an array.
 * @param heap - The heap instance.
 * @param arrayPtr - Pointer to the array block.
 * @param indices - Indices of the element.
 * @returns The retrieved value or UNDEF if out of bounds.
 */
export function arrayGet(
  heap: Heap,
  arrayPtr: number,
  indices: number[]
): number {
  if (!isTaggedValue(arrayPtr)) return UNDEF;
  const { tag, value: block } = fromTaggedValue(Tag.VIEW, arrayPtr);
  if (tag !== Tag.VIEW) return UNDEF;

  const dimensions = heap.memory.read16(block + ARR_DIM);
  if (indices.length !== dimensions) return UNDEF;

  let offset = 0;
  for (let i = 0; i < dimensions; i++) {
    const shape = heap.memory.read16(block + ARR_SPEC + i * 4 + ARR_SHAPE);
    const stride = heap.memory.read16(block + ARR_SPEC + i * 4 + ARR_STRIDES);
    if (indices[i] < 0 || indices[i] >= shape) return UNDEF;
    offset += indices[i] * stride;
  }

  const vectorPtr = heap.memory.read16(block + ARR_VECTOR);
  return vectorGet(heap, toTaggedValue(Tag.VECTOR, vectorPtr), offset);
}

/**
 * Updates an element in an array.
 * @param heap - The heap instance.
 * @param arrayPtr - Pointer to the array block.
 * @param indices - Indices of the element.
 * @param value - New value to set.
 * @returns Updated array pointer.
 */
export function arrayUpdate(
  heap: Heap,
  arrayPtr: number,
  indices: number[],
  value: number
): number {
  if (!isTaggedValue(arrayPtr)) return UNDEF;
  let { tag, value: block } = fromTaggedValue(Tag.VIEW, arrayPtr);
  if (tag !== Tag.VIEW) return UNDEF;

  const dimensions = heap.memory.read16(block + ARR_DIM);
  if (indices.length !== dimensions) return UNDEF;

  let offset = 0;
  for (let i = 0; i < dimensions; i++) {
    const shape = heap.memory.read16(block + ARR_SPEC + i * 4 + ARR_SHAPE);
    const stride = heap.memory.read16(block + ARR_SPEC + i * 4 + ARR_STRIDES);
    if (indices[i] < 0 || indices[i] >= shape) return UNDEF;
    offset += indices[i] * stride;
  }

  const vectorPtr = heap.memory.read16(block + ARR_VECTOR);
  const newVectorPtr = vectorUpdate(
    heap,
    toTaggedValue(Tag.VECTOR, vectorPtr),
    offset,
    value
  );
  if (newVectorPtr === UNDEF) return UNDEF;

  heap.memory.write16(
    block + ARR_VECTOR,
    fromTaggedValue(Tag.VECTOR, newVectorPtr).value
  );
  return toTaggedValue(Tag.VIEW, block);
}
