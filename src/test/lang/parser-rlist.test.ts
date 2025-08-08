import { describe, it, expect, beforeEach } from '@jest/globals';
import { initializeInterpreter, vm } from '../../core/globalState';
import { executeProgram } from '../../lang/interpreter';
import { fromTaggedValue, Tag } from '../../core/tagged';
import { Tokenizer } from '../../lang/tokenizer';
import { parse } from '../../lang/parser';

function top(): number { return vm.getStackData()[vm.getStackData().length - 1]; }

describe('Parser RLIST Integration ([ ])', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  it('parses simple RLIST literal: [ 1 2 3 ] and builds RLIST on stack', () => {
    executeProgram('[ 1 2 3 ]');
    const stack = vm.getStackData();
    expect(stack.length).toBe(4);
    const { tag, value } = fromTaggedValue(top());
    expect(tag).toBe(Tag.RLIST);
    expect(value).toBe(3);
  });

  it('parses nested RLIST: [ 1 [ 2 3 ] 4 ]', () => {
    executeProgram('[ 1 [ 2 3 ] 4 ]');
    const stack = vm.getStackData();
    const header = top();
    const { tag, value } = fromTaggedValue(header);
    expect(tag).toBe(Tag.RLIST);
    expect(value).toBeGreaterThan(0);
  });

  it('parses mixed LIST/RLIST: ( 1 [ 2 3 ] ) and keeps structures', () => {
    executeProgram('( 1 [ 2 3 ] )');
    const stack = vm.getStackData();
    // Expect LINK at TOS pointing back to LIST tag
    const link = top();
    const { tag: linkTag } = fromTaggedValue(link);
    expect(linkTag).toBe(Tag.LINK);

    // LIST tag at start
    const { tag: listTag } = fromTaggedValue(stack[0]);
    expect(listTag).toBe(Tag.LIST);

    // RLIST header should also be present within LIST payload
    const innerIndex = stack.findIndex((v) => fromTaggedValue(v).tag === Tag.RLIST);
    expect(innerIndex).toBeGreaterThanOrEqual(0);
  });

  it('throws on unmatched RLIST closing bracket', () => {
    expect(() => parse(new Tokenizer(']'))).toThrow();
  });

  it('throws on unmatched RLIST opening bracket', () => {
    expect(() => parse(new Tokenizer('[ 1 2 3'))).toThrow();
  });
});
