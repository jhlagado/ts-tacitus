import { describe, test, expect } from '@jest/globals';
import { VM } from '../../core/vm';
import { NIL } from '../../core';

describe.skip('VM constructor registers builtins into heap dict', () => {
  test('new VM has non-NIL dictionary head', () => {
    const local = new VM();
    expect(local.newDictHead).toBeDefined();
    expect(local.newDictHead).not.toBe(NIL);
  });
});
