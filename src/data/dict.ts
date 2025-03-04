// File: src/data/dict.ts

import { Digest } from "../core/digest";
import {
  PrimitiveTag,
  toTaggedValue,
  fromTaggedValue,
  NIL,
  HeapSubType,
} from "../core/tagged";
import { Heap } from "../core/heap";
import { stringCreate } from "./string";
import { vectorCreate, VEC_SIZE, VEC_DATA } from "./vector";
import { SEG_HEAP } from "../core/memory";

/**
 * Creates a dictionary (dict) from a flat array of key-value pairs.
 * The input array must have an even number of elements.
 * Keys (even indices) must be strings.
 * The function validates the input, sorts the pairs by key (using localeCompare),
 * converts keys with stringCreate, and then creates a vector from the flattened data.
 * Finally, it re-tags the resulting pointer with PrimitiveTag.DICT.
 *
 * @param digest - The Digest instance for interning key strings.
 * @param heap - The Heap instance for memory allocation.
 * @param entries - A flat array of key-value pairs: [key1, value1, key2, value2, ...]
 * @returns A tagged pointer (number) with PrimitiveTag.DICT.
 */
export function dictCreate(
  digest: Digest,
  heap: Heap,
  entries: (string | number)[]
): number {
  // Validate that the array length is even.
  if (entries.length % 2 !== 0) {
    throw new Error(
      "The entries array must have an even number of elements (key-value pairs)."
    );
  }

  // Build an array of [key, value] pairs.
  const pairs: [string, number][] = [];
  for (let i = 0; i < entries.length; i += 2) {
    const key = entries[i];
    const value = entries[i + 1];
    if (typeof key !== "string") {
      throw new Error(`Key at index ${i} is not a string.`);
    }
    if (typeof value !== "number") {
      throw new Error(`Value at index ${i + 1} is not a number.`);
    }
    pairs.push([key, value]);
  }

  // Sort the pairs lexicographically by key using localeCompare.
  pairs.sort((a, b) => a[0].localeCompare(b[0]));

  // Build a flattened array of numbers: [taggedKey, value, ...]
  const flattened: number[] = [];
  for (const [key, value] of pairs) {
    // Use stringCreate to intern the key and obtain its tagged string.
    const taggedKey = stringCreate(digest, key);
    flattened.push(taggedKey, value);
  }

  // Create a vector from the flattened data using vectorCreate.
  const vectorTagged = vectorCreate(heap, flattened);
  // Unwrap the raw pointer (assumed to be tagged as PrimitiveTag.VECTOR from vectorCreate).
  const { value: rawPtr } = fromTaggedValue(
    vectorTagged,
    PrimitiveTag.HEAP,
    HeapSubType.VECTOR
  );
  // Retag the vector pointer as a dictionary.
  return toTaggedValue(rawPtr, PrimitiveTag.HEAP, HeapSubType.DICT);
}

/**
 * Retrieves the value associated with a given key from the dictionary.
 * Performs a binary search on the sorted key-value pairs stored in the vector.
 *
 * @param digest - The Digest instance for key interning.
 * @param heap - The Heap instance for memory access.
 * @param dict - The tagged pointer (with PrimitiveTag.DICT) representing the dictionary.
 * @param key - The key string to look up.
 * @returns The associated value if found, or NIL otherwise.
 */
export function dictGet(
  digest: Digest,
  heap: Heap,
  dict: number,
  key: string
): number {
  // Unwrap the dictionary pointer.
  const { value: rawPtr } = fromTaggedValue(
    dict,
    PrimitiveTag.HEAP,
    HeapSubType.DICT
  );
  // Read the total number of elements from the vector header.
  // (Assuming the length is stored at offset VEC_SIZE as a 16-bit value.)
  const totalElements = heap.memory.read16(SEG_HEAP, rawPtr + VEC_SIZE);
  // Each dictionary entry is a key-value pair, so the number of pairs is totalElements/2.
  const numPairs = totalElements / 2;

  let low = 0;
  let high = numPairs - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    // Each pair occupies 8 bytes (4 bytes for the tagged key, 4 for the value).
    // Data begins at offset VEC_DATA.
    const pairOffset = rawPtr + VEC_DATA + mid * 8;
    const taggedKey = heap.memory.readFloat(SEG_HEAP, pairOffset);
    const { value: keyAddr } = fromTaggedValue(taggedKey, PrimitiveTag.STRING);
    const storedKey = digest.get(keyAddr);
    const cmp = storedKey.localeCompare(key);
    if (cmp === 0) {
      // Key found; return the associated value (located 4 bytes after the key).
      return heap.memory.readFloat(SEG_HEAP, pairOffset + 4);
    } else if (cmp < 0) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return NIL;
}
