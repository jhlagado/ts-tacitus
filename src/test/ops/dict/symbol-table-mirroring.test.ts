import { beforeEach, describe, expect, test } from '@jest/globals';
import { executeTacitCode, resetVM } from '../../utils/vm-test-utils';
import { Tag, fromTaggedValue } from '../../../core/tagged';

describe('SymbolTable mirroring to heap dictionary (Phase 0)', () => {
  beforeEach(() => {
    resetVM();
  });

  test('colon definition is mirrored and retrievable via lookup (Tag.CODE)', () => {
    const stack = executeTacitCode(": inc 1 add ; 'inc lookup load");
    expect(stack.length).toBe(1);
    const { tag, value } = fromTaggedValue(stack[0]);
    expect(tag).toBe(Tag.CODE);
    expect(value).toBeGreaterThan(0);
  });
});
