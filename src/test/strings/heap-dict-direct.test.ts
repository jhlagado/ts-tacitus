import { describe, test, expect } from '@jest/globals';
import { VM } from '../../core/vm';
import {
  defineBuiltin as dictDefineBuiltin,
  findTaggedValue as dictFind,
} from '../../strings/symbols';
import { NIL, fromTaggedValue, Tag } from '../../core';
import { Op } from '../../ops/opcodes';

describe.skip('heap dict direct API', () => {
  test('defineBuiltin populates head and find works', () => {
    const v = new VM();
    v.newDictHead = NIL;
    v.gp = 0;
    dictDefineBuiltin(v, 'add', Op.Add);
    expect(v.newDictHead).not.toBe(NIL);
    const tv = dictFind(v, 'add');
    expect(tv).toBeDefined();
    const info = fromTaggedValue(tv!);
    expect(info.tag).toBe(Tag.BUILTIN);
    expect(info.value).toBe(Op.Add);
  });
});
