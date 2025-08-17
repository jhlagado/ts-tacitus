/**
 * Tests for NaN-boxing meta bit functionality.
 * Tests the sign bit usage in tagged values.
 */

import { toTaggedValue, fromTaggedValue, Tag } from '../../core/tagged';

describe('Tagged Value Meta Bit Support', () => {
  describe('toTaggedValue with meta bit', () => {
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
        { value: 42, tag: Tag.BUILTIN },
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
  });

  describe('fromTaggedValue with meta bit', () => {
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
        { value: 50, tag: Tag.BUILTIN, meta: 0 },
        { value: 50, tag: Tag.BUILTIN, meta: 1 },
      ];

      for (const testCase of testCases) {
        const tagged = toTaggedValue(testCase.value, testCase.tag, testCase.meta);
        const decoded = fromTaggedValue(tagged);

        expect(decoded.value).toBe(testCase.value);
        expect(decoded.tag).toBe(testCase.tag);
        expect(decoded.meta).toBe(testCase.meta);
      }
    });
  });

  describe('meta bit distinctness', () => {
    it('should create different NaN values for same value/tag but different meta bits', () => {
      const tagged0 = toTaggedValue(42, Tag.SENTINEL, 0);
      const tagged1 = toTaggedValue(42, Tag.SENTINEL, 1);

      // Check raw bits
      const buffer0 = new ArrayBuffer(4);
      const view0 = new DataView(buffer0);
      view0.setFloat32(0, tagged0, true);
      const bits0 = view0.getUint32(0, true);

      const buffer1 = new ArrayBuffer(4);
      const view1 = new DataView(buffer1);
      view1.setFloat32(0, tagged1, true);
      const bits1 = view1.getUint32(0, true);

      // Different meta bits should produce different raw bit patterns
      expect(bits0).not.toBe(bits1);

      // But they should decode to the same logical value with different meta
      const decoded0 = fromTaggedValue(tagged0);
      const decoded1 = fromTaggedValue(tagged1);

      expect(decoded0.value).toBe(decoded1.value);
      expect(decoded0.tag).toBe(decoded1.tag);
      expect(decoded0.meta).not.toBe(decoded1.meta);
    });
  });

  describe('backward compatibility', () => {
    it('should work with existing code that destructures without meta', () => {
      const tagged = toTaggedValue(42, Tag.SENTINEL, 1);

      // This should work without errors (typical existing usage)
      const { value, tag } = fromTaggedValue(tagged);

      expect(value).toBe(42);
      expect(tag).toBe(Tag.SENTINEL);
      // meta is available but not destructured
    });
  });
});
