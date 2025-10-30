import { describe, test, expect } from '@jest/globals';
import { VM } from '../../core/vm';
import { Op } from '../../ops/opcodes';
import { NIL, fromTaggedValue, Tag } from '../../core';

describe.skip('symbolTable.defineBuiltin mirrors into heap dict when VM attached', () => {
  test('manual defineBuiltin updates vm.newDictHead and resolvable', () => {
    const local = new VM();
    local.newDictHead = NIL;
    local.gp = 0;
    local.symbolTable.defineBuiltin('add', Op.Add);
    expect(local.newDictHead).not.toBe(NIL);
    const tv = local.symbolTable.findTaggedValue('add');
    expect(tv).toBeDefined();
    const info = fromTaggedValue(tv!);
    expect(info.tag).toBe(Tag.BUILTIN);
    expect(info.value).toBe(Op.Add);
  });
});
