// File: src/tests/dict.test.ts

import { Memory, SEG_HEAP } from '../core/memory';
import { Digest } from '../strings/digest';
import { Heap } from './heap';
import { dictCreate, dictGet } from '../heap/dict';
import { NIL, fromTaggedValue } from '../core/tagged';
import { INVALID } from '../core/constants';

describe('Dictionary (dict) Tests', () => {
  let memory: Memory;
  let digest: Digest;
  let heap: Heap;

  beforeEach(() => {
    memory = new Memory();
    digest = new Digest(memory);
    heap = new Heap(memory);
  });

  it('dictCreate returns a tagged pointer with PrimitiveTag.DICT', () => {
    const entries = ['a', 1, 'b', 2, 'c', 3];
    const dict = dictCreate(digest, heap, entries);
    const { value } = fromTaggedValue(dict);
    expect(value).not.toBe(INVALID);
  });

  it('dictCreate throws an error for odd number of entries', () => {
    const entries = ['a', 1, 'b']; // Odd length array
    expect(() => dictCreate(digest, heap, entries)).toThrow(/even number of elements/);
  });

  it('dictCreate throws an error when a key is not a string', () => {
    const entries = [42, 1, 'b', 2]; // First key is not a string
    expect(() => dictCreate(digest, heap, entries)).toThrow(/Key at index 0 is not a string/);
  });

  it('dictCreate throws an error when a value is not a number', () => {
    const entries = ['a', 1, 'b', 'not a number'];
    expect(() => dictCreate(digest, heap, entries)).toThrow(/Value at index 3 is not a number/);
  });

  it('dictCreate sorts the key-value pairs lexicographically', () => {
    // Provide unsorted input.
    const entries = ['z', 100, 'a', 1, 'm', 50];
    // After sorting, keys should be: "a", "m", "z".
    const dict = dictCreate(digest, heap, entries);
    expect(dictGet(digest, heap, dict, 'a')).toBe(1);
    expect(dictGet(digest, heap, dict, 'm')).toBe(50);
    expect(dictGet(digest, heap, dict, 'z')).toBe(100);
  });

  it('dictGet returns correct values for existing keys', () => {
    const entries = ['apple', 10, 'banana', 20, 'cherry', 30];
    const dict = dictCreate(digest, heap, entries);
    expect(dictGet(digest, heap, dict, 'apple')).toBe(10);
    expect(dictGet(digest, heap, dict, 'banana')).toBe(20);
    expect(dictGet(digest, heap, dict, 'cherry')).toBe(30);
  });

  it('dictGet returns NIL for non-existent keys', () => {
    const entries = ['apple', 10, 'banana', 20];
    const dict = dictCreate(digest, heap, entries);
    expect(dictGet(digest, heap, dict, 'cherry')).toBe(NIL);
  });

  it('dictCreate handles an empty entries array', () => {
    const entries: (string | number)[] = [];
    const dict = dictCreate(digest, heap, entries);
    // For an empty vector, the header length should be 0.
    const { value: rawPtr } = fromTaggedValue(dict);
    const totalElements = memory.read16(SEG_HEAP, rawPtr + 4); // VEC_SIZE is imported as 4
    expect(totalElements).toBe(0);
    // Lookup should return NIL.
    expect(dictGet(digest, heap, dict, 'anything')).toBe(NIL);
  });

  it('dictGet binary search finds correct values with similar keys', () => {
    const entries = ['alpha', 1, 'alphabet', 2, 'beta', 3, 'gamma', 4];
    const dict = dictCreate(digest, heap, entries);
    expect(dictGet(digest, heap, dict, 'alpha')).toBe(1);
    expect(dictGet(digest, heap, dict, 'alphabet')).toBe(2);
    expect(dictGet(digest, heap, dict, 'beta')).toBe(3);
    expect(dictGet(digest, heap, dict, 'gamma')).toBe(4);
  });
});
