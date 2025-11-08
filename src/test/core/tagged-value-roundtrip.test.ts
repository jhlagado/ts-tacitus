import { describe, test, expect, beforeEach } from '@jest/globals';
import { toTaggedValue, fromTaggedValue, Tag } from '../../core/tagged';
import { createVM, type VM } from '../../core/vm';

describe('dictionary-only builtins', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });
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
