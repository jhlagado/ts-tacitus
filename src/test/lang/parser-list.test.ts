import { describe, it, expect, beforeEach } from '@jest/globals';
import { initializeInterpreter, vm } from '../../core/globalState';
import { executeProgram } from '../../lang/interpreter';
import { fromTaggedValue, Tag } from '../../core';
import { Tokenizer } from '../../lang/tokenizer';
import { parse } from '../../lang/parser';

function top(): number {
  return vm.getStackData()[vm.getStackData().length - 1];
}

describe('Parser LIST Integration (() )', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  it('parses simple LIST literal: ( 1 2 3 ) and builds LIST on stack', () => {
    executeProgram('( 1 2 3 )');
    const stack = vm.getStackData();
    expect(stack.length).toBe(4);
    const { tag, value } = fromTaggedValue(top());
    expect(tag).toBe(Tag.LIST);
    expect(value).toBe(3);
  });

  it('parses nested LIST: ( 1 ( 2 3 ) 4 )', () => {
    executeProgram('( 1 ( 2 3 ) 4 )');
    const header = top();
    const { tag, value } = fromTaggedValue(header);
    expect(tag).toBe(Tag.LIST);
    expect(value).toBeGreaterThan(0);
  });

  it('throws on unmatched LIST closing bracket', () => {
    expect(() => parse(new Tokenizer(')'))).toThrow();
  });

  it('throws on unmatched LIST opening bracket', () => {
    expect(() => parse(new Tokenizer('( 1 2 3'))).toThrow();
  });
});
