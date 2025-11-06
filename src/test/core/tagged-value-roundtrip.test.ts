import { describe, test, expect } from '@jest/globals';
import { toTaggedValue, fromTaggedValue, Tag } from '../../core/tagged';

import { resetVM } from '../utils/vm-test-utils';
import { vm } from '../../lang/runtime';

describe('dictionary-only builtins', () => {
  beforeEach(() => resetVM());
  test('convert to tagged value and decode from 0 to 1000', () => {
    vm.gp = 0;
    for (let i = 0; i <= 1000; i++) {
      // Convert number to SENTINEL tagged value
      const tagged = toTaggedValue(vm.gp++, Tag.SENTINEL);

      // Decode back to get the value
      const decoded = fromTaggedValue(tagged);

      // Print results
      console.log(
        `Value: ${i.toString().padStart(4)} → Tagged: ${tagged} → Decoded: tag=${decoded.tag}, value=${decoded.value}, meta=${decoded.meta}`,
      );

      // Verify the roundtrip
      expect(decoded.tag).toBe(Tag.SENTINEL);
      expect(decoded.value).toBe(i);
      expect(decoded.meta).toBe(0);
    }
  });
});
