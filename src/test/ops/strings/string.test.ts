import { type Memory, createMemory } from '../../../core';
import { type Digest, createDigest, digestGet, digestLength } from '../../../../src/strings/digest';
import { stringCreate } from '../../../../src/strings/string';
import { Tag, getTaggedInfo } from '../../../core/tagged';

describe('stringCreate', () => {
  let memory: Memory;
  let digest: Digest;
  beforeEach(() => {
    memory = createMemory();
    digest = createDigest(memory);
  });
  test('should create a tagged string with Tag.STRING', () => {
    const value = 'hello';
    const taggedValue = stringCreate(digest, value);
    const { tag, value: address } = getTaggedInfo(taggedValue);
    expect(tag).toBe(Tag.STRING);
    expect(digestGet(digest, address)).toBe(value);
  });
  test('should create distinct tagged strings for multiple calls', () => {
    const str1 = 'foo';
    const str2 = 'bar';
    const tagged1 = stringCreate(digest, str1);
    const tagged2 = stringCreate(digest, str2);
    const { value: address1 } = getTaggedInfo(tagged1);
    const { value: address2 } = getTaggedInfo(tagged2);
    expect(address1).not.toBe(address2);
    expect(digestGet(digest, address1)).toBe(str1);
    expect(digestGet(digest, address2)).toBe(str2);
  });
  test('should handle empty strings correctly', () => {
    const value = '';
    const taggedValue = stringCreate(digest, value);
    const { value: address } = getTaggedInfo(taggedValue);
    expect(digestGet(digest, address)).toBe(value);
  });
  test('should throw an error if the string exceeds maximum length', () => {
    const longString = 'a'.repeat(256);
    expect(() => stringCreate(digest, longString)).toThrow('String too long (max 255 characters)');
  });
  test('should correctly store multiple strings in sequence', () => {
    const strings = ['first', 'second', 'third'];
    const taggedValues = strings.map(s => stringCreate(digest, s));
    taggedValues.forEach((tagged, index) => {
      const { value: address } = getTaggedInfo(tagged);
      expect(digestGet(digest, address)).toBe(strings[index]);
    });
  });
  test('should report the correct length for a non-empty string', () => {
    const value = 'hello';
    const taggedValue = stringCreate(digest, value);
    const { value: address } = getTaggedInfo(taggedValue);
    expect(digestLength(digest, address)).toBe(value.length);
  });
  test('should report the correct length for an empty string', () => {
    const value = '';
    const taggedValue = stringCreate(digest, value);
    const { value: address } = getTaggedInfo(taggedValue);
    expect(digestLength(digest, address)).toBe(value.length);
  });
});
