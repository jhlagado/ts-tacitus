import { describe, it, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../core';
import { executeProgram } from '../../lang/interpreter';
import { fromTaggedValue, Tag } from '../../core';
import { Tokenizer } from '../../lang/tokenizer';
import { parse } from '../../lang/parser';
import { getStackData } from '../../core/vm';

describe('Parser LIST Integration (() )', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  function top(): number {
    return getStackData(vm)[getStackData(vm).length - 1];
  }

  it('parses simple LIST literal: ( 1 2 3 ) and builds LIST on stack', () => {
    executeProgram(vm, '( 1 2 3 )');
    const stack = getStackData(vm);
    expect(stack.length).toBe(4);
    const { tag, value } = fromTaggedValue(top());
    expect(tag).toBe(Tag.LIST);
    expect(value).toBe(3);
  });

  it('parses nested LIST: ( 1 ( 2 3 ) 4 )', () => {
    executeProgram(vm, '( 1 ( 2 3 ) 4 )');
    const header = top();
    const { tag, value } = fromTaggedValue(header);
    expect(tag).toBe(Tag.LIST);
    expect(value).toBeGreaterThan(0);
  });

  it('throws on unmatched LIST closing bracket', () => {
    expect(() => parse(vm, new Tokenizer(')'))).toThrow();
  });

  it('throws on unmatched LIST opening bracket', () => {
    expect(() => parse(vm, new Tokenizer('( 1 2 3'))).toThrow();
  });
});
