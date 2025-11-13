/* eslint-disable @typescript-eslint/no-explicit-any */
import { Tag, Tagged, getTaggedInfo, isNIL, isCode, isLocal, MAX_TAG } from '../../core';
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
      const encoded = Tagged(value, tag);
      const decoded = getTaggedInfo(encoded);
      expect(decoded.tag).toBe(tag);
      expect(decoded.value).toBe(value);
    });
  });

  test('should throw on invalid tag ranges', () => {
    const invalidTag = MAX_TAG + 1;
    expect(() => Tagged(0, invalidTag as any)).toThrow(`Invalid tag: ${invalidTag}`);
  });
  test('should validate value ranges for INTEGER', () => {
    expect(() => Tagged(32768, Tag.SENTINEL)).toThrow();
    expect(() => Tagged(-32769, Tag.SENTINEL)).toThrow();
  });
  test('should validate unsigned value ranges for non-INTEGER types', () => {
    expect(() => Tagged(-1, Tag.CODE)).toThrow();
    expect(() => Tagged(encodeX1516(65536), Tag.CODE)).toThrow();
    expect(() => Tagged(-1, Tag.STRING)).toThrow();
    expect(() => Tagged(65536, Tag.STRING)).toThrow();
  });
  test('should correctly extract value for integer types', () => {
    const encodedNeg = Tagged(-32768, Tag.SENTINEL);
    const encodedPos = Tagged(32767, Tag.SENTINEL);
    const decodedNeg = getTaggedInfo(encodedNeg);
    const decodedPos = getTaggedInfo(encodedPos);
    expect(decodedNeg.value).toBe(-32768);
    expect(decodedPos.value).toBe(32767);
  });

  test('should return the correct tag using getTaggedInfo', () => {
    const encoded = Tagged(encodeX1516(123), Tag.CODE);
    const { tag } = getTaggedInfo(encoded);
    expect(tag).toBe(Tag.CODE);
  });
  test('should return the correct value using getValue', () => {
    const encoded = Tagged(encodeX1516(456), Tag.CODE);
    const { value } = getTaggedInfo(encoded);
    expect(value).toBe(encodeX1516(456));
  });
  test('should correctly identify NIL using isNIL', () => {
    expect(isNIL(Tagged(0, Tag.SENTINEL))).toBe(true);
    expect(isNIL(Tagged(1, Tag.SENTINEL))).toBe(false);
  });
  test('should correctly identify code types', () => {
    const code = Tagged(encodeX1516(123), Tag.CODE);
    const str = Tagged(789, Tag.STRING);
    expect(isCode(code)).toBe(true);
    expect(isCode(str)).toBe(false);
  });

  describe('Tag.LOCAL values', () => {
    test('should create LOCAL tagged value with slot number', () => {
      const localRef = Tagged(5, Tag.LOCAL);
      expect(isLocal(localRef)).toBe(true);
      expect(getTaggedInfo(localRef).value).toBe(5);
      expect(getTaggedInfo(localRef).tag).toBe(Tag.LOCAL);
    });

    test('should handle 16-bit slot numbers', () => {
      const maxSlot = 65535;
      const localRef = Tagged(maxSlot, Tag.LOCAL);
      expect(isLocal(localRef)).toBe(true);
      expect(getTaggedInfo(localRef).value).toBe(maxSlot);
    });

    test('should handle slot number zero', () => {
      const localRef = Tagged(0, Tag.LOCAL);
      expect(isLocal(localRef)).toBe(true);
      expect(getTaggedInfo(localRef).value).toBe(0);
    });

    test('should not identify non-LOCAL values as LOCAL', () => {
      expect(isLocal(Tagged(42, Tag.NUMBER))).toBe(false);
      expect(isLocal(Tagged(100, Tag.CODE))).toBe(false);
      expect(isLocal(Tagged(encodeX1516(200), Tag.CODE))).toBe(false);
      expect(isLocal(Tagged(300, Tag.STRING))).toBe(false);
    });

    test('should validate slot number bounds', () => {
      expect(() => Tagged(-1, Tag.LOCAL)).toThrow('Value must be 16-bit unsigned integer');
      expect(() => Tagged(65536, Tag.LOCAL)).toThrow('Value must be 16-bit unsigned integer');
    });

    test('should work with meta bits', () => {
      const localRefWithMeta = Tagged(10, Tag.LOCAL, 1);
      expect(isLocal(localRefWithMeta)).toBe(true);
      expect(getTaggedInfo(localRefWithMeta).value).toBe(10);
      expect(getTaggedInfo(localRefWithMeta).meta).toBe(1);
    });
  });

  describe('Meta bit support', () => {
    it('should create tagged value with meta=0 (default)', () => {
      const tagged = Tagged(42, Tag.SENTINEL);
      const { value, tag, meta } = getTaggedInfo(tagged);

      expect(value).toBe(42);
      expect(tag).toBe(Tag.SENTINEL);
      expect(meta).toBe(0);
    });

    it('should create tagged value with meta=0 (explicit)', () => {
      const tagged = Tagged(42, Tag.SENTINEL, 0);
      const { value, tag, meta } = getTaggedInfo(tagged);

      expect(value).toBe(42);
      expect(tag).toBe(Tag.SENTINEL);
      expect(meta).toBe(0);
    });

    it('should create tagged value with meta=1', () => {
      const tagged = Tagged(42, Tag.SENTINEL, 1);
      const { value, tag, meta } = getTaggedInfo(tagged);

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
        const tagged = Tagged(testCase.value, testCase.tag, 1);
        const { value, tag, meta } = getTaggedInfo(tagged);

        expect(value).toBe(testCase.value);
        expect(tag).toBe(testCase.tag);
        expect(meta).toBe(1);
      }
    });

    it('should throw error for invalid meta bit values', () => {
      expect(() => Tagged(42, Tag.SENTINEL, 2)).toThrow('Meta bit must be 0 or 1, got: 2');
      expect(() => Tagged(42, Tag.SENTINEL, -1)).toThrow('Meta bit must be 0 or 1, got: -1');
      expect(() => Tagged(42, Tag.SENTINEL, 0.5)).toThrow('Meta bit must be 0 or 1, got: 0.5');
    });

    it('should throw error when trying to set meta bit on NUMBER tag', () => {
      expect(() => Tagged(3.14, Tag.NUMBER, 1)).toThrow(
        'Meta bit must be 0 for NUMBER tag (stored as raw IEEE 754)',
      );
    });

    it('should return meta=0 for NUMBER tags', () => {
      const { value, tag, meta } = getTaggedInfo(3.14);

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
        const tagged = Tagged(testCase.value, testCase.tag, testCase.meta);
        const decoded = getTaggedInfo(tagged);

        expect(decoded.value).toBe(testCase.value);
        expect(decoded.tag).toBe(testCase.tag);
        expect(decoded.meta).toBe(testCase.meta);
      }
    });

    it('should create different NaN values for same value/tag but different meta bits', () => {
      const tagged0 = Tagged(42, Tag.SENTINEL, 0);
      const tagged1 = Tagged(42, Tag.SENTINEL, 1);

      const buffer0 = new ArrayBuffer(4);
      const view0 = new DataView(buffer0);
      view0.setFloat32(0, tagged0, true);
      const bits0 = view0.getUint32(0, true);

      const buffer1 = new ArrayBuffer(4);
      const view1 = new DataView(buffer1);
      view1.setFloat32(0, tagged1, true);
      const bits1 = view1.getUint32(0, true);

      expect(bits0).not.toBe(bits1);

      const decoded0 = getTaggedInfo(tagged0);
      const decoded1 = getTaggedInfo(tagged1);

      expect(decoded0.value).toBe(decoded1.value);
      expect(decoded0.tag).toBe(decoded1.tag);
      expect(decoded0.meta).not.toBe(decoded1.meta);
    });

    it('should work with existing code that destructures without meta', () => {
      const tagged = Tagged(42, Tag.SENTINEL, 1);

      const { value, tag } = getTaggedInfo(tagged);

      expect(value).toBe(42);
      expect(tag).toBe(Tag.SENTINEL);
    });
  });

  describe('Round-trip conversion', () => {
    test('convert to tagged value and decode edge cases', () => {
      // Test key edge cases instead of 0-1000 range
      const testCases = [0, 1, 255, 256, 32767, -32768, -1];

      for (const value of testCases) {
        const tagged = Tagged(value, Tag.SENTINEL);
        const decoded = getTaggedInfo(tagged);

        expect(decoded.tag).toBe(Tag.SENTINEL);
        expect(decoded.value).toBe(value);
        expect(decoded.meta).toBe(0);
      }
    });
  });
});
