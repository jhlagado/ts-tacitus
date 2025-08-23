/**
 * @file src/test/core/tagged-local.test.ts
 * Tests for Tag.LOCAL tagged values
 */

import { toTaggedValue, fromTaggedValue, isLocal, Tag } from '../../core/tagged';

describe('Tag.LOCAL Tagged Values', () => {
  test('should create LOCAL tagged value with slot number', () => {
    const localRef = toTaggedValue(5, Tag.LOCAL);
    expect(isLocal(localRef)).toBe(true);
    expect(fromTaggedValue(localRef).value).toBe(5);
    expect(fromTaggedValue(localRef).tag).toBe(Tag.LOCAL);
  });

  test('should handle 16-bit slot numbers', () => {
    const maxSlot = 65535;
    const localRef = toTaggedValue(maxSlot, Tag.LOCAL);
    expect(isLocal(localRef)).toBe(true);
    expect(fromTaggedValue(localRef).value).toBe(maxSlot);
  });

  test('should handle slot number zero', () => {
    const localRef = toTaggedValue(0, Tag.LOCAL);
    expect(isLocal(localRef)).toBe(true);
    expect(fromTaggedValue(localRef).value).toBe(0);
  });

  test('should not identify non-LOCAL values as LOCAL', () => {
    expect(isLocal(toTaggedValue(42, Tag.NUMBER))).toBe(false);
    expect(isLocal(toTaggedValue(100, Tag.BUILTIN))).toBe(false);
    expect(isLocal(toTaggedValue(200, Tag.CODE))).toBe(false);
    expect(isLocal(toTaggedValue(300, Tag.STRING))).toBe(false);
  });

  test('should validate slot number bounds', () => {
    expect(() => toTaggedValue(-1, Tag.LOCAL)).toThrow('Value must be 16-bit unsigned integer');
    expect(() => toTaggedValue(65536, Tag.LOCAL)).toThrow('Value must be 16-bit unsigned integer');
  });

  test('should work with meta bits', () => {
    const localRefWithMeta = toTaggedValue(10, Tag.LOCAL, 1);
    expect(isLocal(localRefWithMeta)).toBe(true);
    expect(fromTaggedValue(localRefWithMeta).value).toBe(10);
    expect(fromTaggedValue(localRefWithMeta).meta).toBe(1);
  });
});