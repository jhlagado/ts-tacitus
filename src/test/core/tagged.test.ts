/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Tag,
  toTaggedValue,
  fromTaggedValue,
  getTag,
  getValue,
  isNIL,
  isCode,
  isLocal,
  MAX_TAG,
} from '../../core';
import { encodeX1516, decodeX1516 } from '../../core/code-ref';

describe('Tagged NaN Encoding', () => {
  test('should correctly decode encoded values', () => {
    const tests = [
      { tag: Tag.SENTINEL, value: -32768 },
      { tag: Tag.SENTINEL, value: 32767 },
      { tag: Tag.CODE, value: 12345 },
      { tag: Tag.STRING, value: 42 },
    ];

    tests.forEach(({ tag, value }) => {
      const encoded = toTaggedValue(value, tag);
      const decoded = fromTaggedValue(encoded);
      expect(decoded.tag).toBe(tag);
      expect(decoded.value).toBe(value);
    });
  });

  test('should throw on invalid tag ranges', () => {
    const invalidTag = MAX_TAG + 1;
    expect(() => toTaggedValue(0, invalidTag as any)).toThrow(`Invalid tag: ${invalidTag}`);
  });
  test('should validate value ranges for INTEGER', () => {
    expect(() => toTaggedValue(32768, Tag.SENTINEL)).toThrow();
    expect(() => toTaggedValue(-32769, Tag.SENTINEL)).toThrow();
  });
  test('should validate unsigned value ranges for non-INTEGER types', () => {
    expect(() => toTaggedValue(-1, Tag.CODE)).toThrow();
    expect(() => toTaggedValue(encodeX1516(65536), Tag.CODE)).toThrow();
    expect(() => toTaggedValue(-1, Tag.STRING)).toThrow();
    expect(() => toTaggedValue(65536, Tag.STRING)).toThrow();
  });
  test('should correctly extract value for integer types', () => {
    const encodedNeg = toTaggedValue(-32768, Tag.SENTINEL);
    const encodedPos = toTaggedValue(32767, Tag.SENTINEL);
    const decodedNeg = fromTaggedValue(encodedNeg);
    const decodedPos = fromTaggedValue(encodedPos);
    expect(decodedNeg.value).toBe(-32768);
    expect(decodedPos.value).toBe(32767);
  });

  test('should return the correct tag using getTag', () => {
    const encoded = toTaggedValue(encodeX1516(123), Tag.CODE);
    expect(getTag(encoded)).toBe(Tag.CODE);
  });
  test('should return the correct value using getValue', () => {
    const encoded = toTaggedValue(encodeX1516(456), Tag.CODE);
    expect(getValue(encoded)).toBe(encodeX1516(456));
  });
  test('should correctly identify NIL using isNIL', () => {
    expect(isNIL(toTaggedValue(0, Tag.SENTINEL))).toBe(true);
    expect(isNIL(toTaggedValue(1, Tag.SENTINEL))).toBe(false);
  });
  test('should correctly identify code types', () => {
    const code = toTaggedValue(encodeX1516(123), Tag.CODE);
    const str = toTaggedValue(789, Tag.STRING);
    expect(isCode(code)).toBe(true);
    expect(isCode(str)).toBe(false);
  });

  describe('Tag.LOCAL values', () => {
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
      expect(isLocal(toTaggedValue(100, Tag.CODE))).toBe(false);
      expect(isLocal(toTaggedValue(encodeX1516(200), Tag.CODE))).toBe(false);
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

  describe('Meta bit support', () => {
    it('should create tagged value with meta=0 (default)', () => {
      const tagged = toTaggedValue(42, Tag.SENTINEL);
      const { value, tag, meta } = fromTaggedValue(tagged);

      expect(value).toBe(42);
      expect(tag).toBe(Tag.SENTINEL);
      expect(meta).toBe(0);
    });

    it('should create tagged value with meta=0 (explicit)', () => {
      const tagged = toTaggedValue(42, Tag.SENTINEL, 0);
      const { value, tag, meta } = fromTaggedValue(tagged);

      expect(value).toBe(42);
      expect(tag).toBe(Tag.SENTINEL);
      expect(meta).toBe(0);
    });

    it('should create tagged value with meta=1', () => {
      const tagged = toTaggedValue(42, Tag.SENTINEL, 1);
      const { value, tag, meta } = fromTaggedValue(tagged);

      expect(value).toBe(42);
      expect(tag).toBe(Tag.SENTINEL);
      expect(meta).toBe(1);
    });

    it('should work with different tag types and meta=1', () => {
      const testCases = [
        { value: 100, tag: Tag.CODE },
        { value: 200, tag: Tag.STRING },
        { value: 42, tag: Tag.CODE },
        { value: 5, tag: Tag.LIST },
      ];

      for (const testCase of testCases) {
        const tagged = toTaggedValue(testCase.value, testCase.tag, 1);
        const { value, tag, meta } = fromTaggedValue(tagged);

        expect(value).toBe(testCase.value);
        expect(tag).toBe(testCase.tag);
        expect(meta).toBe(1);
      }
    });

    it('should throw error for invalid meta bit values', () => {
      expect(() => toTaggedValue(42, Tag.SENTINEL, 2)).toThrow('Meta bit must be 0 or 1, got: 2');
      expect(() => toTaggedValue(42, Tag.SENTINEL, -1)).toThrow('Meta bit must be 0 or 1, got: -1');
      expect(() => toTaggedValue(42, Tag.SENTINEL, 0.5)).toThrow(
        'Meta bit must be 0 or 1, got: 0.5',
      );
    });

    it('should throw error when trying to set meta bit on NUMBER tag', () => {
      expect(() => toTaggedValue(3.14, Tag.NUMBER, 1)).toThrow(
        'Meta bit must be 0 for NUMBER tag (stored as raw IEEE 754)',
      );
    });

    it('should return meta=0 for NUMBER tags', () => {
      const { value, tag, meta } = fromTaggedValue(3.14);

      expect(value).toBe(3.14);
      expect(tag).toBe(Tag.NUMBER);
      expect(meta).toBe(0);
    });

    it('should preserve meta bit across round-trip encoding', () => {
      const testCases = [
        { value: 42, tag: Tag.SENTINEL, meta: 0 },
        { value: 42, tag: Tag.SENTINEL, meta: 1 },
        { value: 1000, tag: Tag.CODE, meta: 0 },
        { value: 1000, tag: Tag.CODE, meta: 1 },
        { value: 50, tag: Tag.CODE, meta: 0 },
        { value: 50, tag: Tag.CODE, meta: 1 },
      ];

      for (const testCase of testCases) {
        const tagged = toTaggedValue(testCase.value, testCase.tag, testCase.meta);
        const decoded = fromTaggedValue(tagged);

        expect(decoded.value).toBe(testCase.value);
        expect(decoded.tag).toBe(testCase.tag);
        expect(decoded.meta).toBe(testCase.meta);
      }
    });

    it('should create different NaN values for same value/tag but different meta bits', () => {
      const tagged0 = toTaggedValue(42, Tag.SENTINEL, 0);
      const tagged1 = toTaggedValue(42, Tag.SENTINEL, 1);

      const buffer0 = new ArrayBuffer(4);
      const view0 = new DataView(buffer0);
      view0.setFloat32(0, tagged0, true);
      const bits0 = view0.getUint32(0, true);

      const buffer1 = new ArrayBuffer(4);
      const view1 = new DataView(buffer1);
      view1.setFloat32(0, tagged1, true);
      const bits1 = view1.getUint32(0, true);

      expect(bits0).not.toBe(bits1);

      const decoded0 = fromTaggedValue(tagged0);
      const decoded1 = fromTaggedValue(tagged1);

      expect(decoded0.value).toBe(decoded1.value);
      expect(decoded0.tag).toBe(decoded1.tag);
      expect(decoded0.meta).not.toBe(decoded1.meta);
    });

    it('should work with existing code that destructures without meta', () => {
      const tagged = toTaggedValue(42, Tag.SENTINEL, 1);

      const { value, tag } = fromTaggedValue(tagged);

      expect(value).toBe(42);
      expect(tag).toBe(Tag.SENTINEL);
    });
  });

  describe('Round-trip conversion', () => {
    test('convert to tagged value and decode edge cases', () => {
      // Test key edge cases instead of 0-1000 range
      const testCases = [0, 1, 255, 256, 32767, -32768, -1];

      for (const value of testCases) {
        const tagged = toTaggedValue(value, Tag.SENTINEL);
        const decoded = fromTaggedValue(tagged);

        expect(decoded.tag).toBe(Tag.SENTINEL);
        expect(decoded.value).toBe(value);
        expect(decoded.meta).toBe(0);
      }
    });
  });
});
