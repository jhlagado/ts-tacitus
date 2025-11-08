import { describe, test, expect, beforeEach } from '@jest/globals';
import { toTaggedValue, fromTaggedValue, Tag } from '../../core/tagged';
import { createVM, type VM } from '../../core/vm';

describe('dictionary-only builtins', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });
  test('convert to tagged value and decode from 0 to 1000', () => {
    vm.gp = 0;
    for (let i = 0; i <= 1000; i++) {
      // Convert number to SENTINEL tagged value
      const tagged = toTaggedValue(vm.gp++, Tag.SENTINEL);

      // Decode back to get the value
      const decoded = fromTaggedValue(tagged);

      // Verify the roundtrip
      expect(decoded.tag).toBe(Tag.SENTINEL);
      expect(decoded.value).toBe(i);
      expect(decoded.meta).toBe(0);
    }
  });
});
