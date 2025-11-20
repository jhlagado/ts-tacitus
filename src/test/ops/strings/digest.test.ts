import {
  type Digest,
  createDigest,
  digestAdd,
  digestGet,
  digestLength,
  digestRemainingSpace,
  digestFind,
  digestIntern,
} from '../../../../src/strings/digest';
import { type Memory, createMemory } from '../../../core';
import { STRING_SIZE_BYTES } from '../../../core/constants';

describe('Digest', () => {
  let memory: Memory;
  let digest: Digest;
  beforeEach(() => {
    memory = createMemory();
    digest = createDigest(memory);
  });
  test('should add a string, retrieve it, and report its length', () => {
    const address = digestAdd(digest, 'hello');
    expect(address).toBe(0);
    expect(digestGet(digest, address)).toBe('hello');
    expect(digestLength(digest, address)).toBe(5);
  });
  test('should correctly handle an empty string', () => {
    const address = digestAdd(digest, '');
    expect(digestGet(digest, address)).toBe('');
    expect(digestLength(digest, address)).toBe(0);
  });
  test('should correctly handle strings with special characters', () => {
    const specialString = 'hello\nworld\t!';
    const address = digestAdd(digest, specialString);
    expect(digestGet(digest, address)).toBe(specialString);
  });
  test('should correctly handle a string with maximum length', () => {
    const maxLengthString = 'a'.repeat(255);
    const address = digestAdd(digest, maxLengthString);
    expect(digestGet(digest, address)).toBe(maxLengthString);
    expect(digestLength(digest, address)).toBe(255);
  });
  test('should throw an error if the string is too long', () => {
    const longString = 'a'.repeat(256);
    expect(() => digestAdd(digest, longString)).toThrow('String too long');
  });
  test('should throw an error if there is not enough space in memory', () => {
    const smallString = 'a'.repeat(255);
    const numStrings = Math.floor(STRING_SIZE_BYTES / (smallString.length + 1));
    for (let i = 0; i < numStrings; i++) {
      digestAdd(digest, smallString);
    }

    expect(() => digestAdd(digest, 'b')).toThrow('String digest overflow');
  });
  test('should find an existing string and return -1 for a non-existent string', () => {
    const addr = digestAdd(digest, 'test');
    expect(digestFind(digest, 'test')).toBe(addr);
    expect(digestFind(digest, 'nonexistent')).toBe(-1);
  });
  test('intern should return the same address for duplicates and a different address for new strings', () => {
    const addr1 = digestIntern(digest, 'hello');
    const addr2 = digestIntern(digest, 'hello');
    expect(addr1).toBe(addr2);
    const addr3 = digestIntern(digest, 'world');
    expect(addr3).not.toBe(addr1);
    expect(digestGet(digest, addr1)).toBe('hello');
    expect(digestGet(digest, addr3)).toBe('world');
  });
  test('should correctly handle adding and retrieving multiple strings', () => {
    const addr1 = digestAdd(digest, 'first');
    const addr2 = digestAdd(digest, 'second');
    const addr3 = digestAdd(digest, 'third');
    expect(digestGet(digest, addr1)).toBe('first');
    expect(digestGet(digest, addr2)).toBe('second');
    expect(digestGet(digest, addr3)).toBe('third');
  });
  test('should throw an error when reading from an invalid address', () => {
    expect(() => digestGet(digest, -1)).toThrow('Address is outside memory bounds');
    expect(() => digestGet(digest, STRING_SIZE_BYTES)).toThrow('Address is outside memory bounds');
  });
  test('should correctly report remaining space', () => {
    const initialSpace = digestRemainingSpace(digest);
    digestAdd(digest, 'data');
    expect(digestRemainingSpace(digest)).toBe(initialSpace - (1 + 'data'.length));
  });
});
