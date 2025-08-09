import { describe, it, expect, beforeEach } from '@jest/globals';
import { initializeInterpreter, vm } from '../../core/globalState';
import { Tokenizer } from '../../lang/tokenizer';
import { parse } from '../../lang/parser';
import { Op } from '../../ops/opcodes';

function decodeFloatLE(bytes: number[], offset: number): number {
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setUint8(0, bytes[offset]);
  view.setUint8(1, bytes[offset + 1]);
  view.setUint8(2, bytes[offset + 2]);
  view.setUint8(3, bytes[offset + 3]);
  return view.getFloat32(0, true);
}

describe('LIST Literal Compilation', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  it('compiles a simple LIST literal: ( 1 2 3 )', () => {
    parse(new Tokenizer('( 1 2 3 )'));
    const code = vm.getCompileData();

    // Expected opcode sequence: OpenList, (LitNum, f32)*3, CloseList, Abort
    let i = 0;
    expect(code[i++]).toBe(Op.OpenList);

    for (const expected of [1, 2, 3]) {
      expect(code[i++]).toBe(Op.LiteralNumber);
      const value = decodeFloatLE(code, i);
      expect(Math.round(value)).toBe(expected);
      i += 4;
    }

    expect(code[i++]).toBe(Op.CloseList);
    expect(code[i]).toBe(Op.Abort);
  });

  it('compiles nested LIST literal: ( 1 ( 2 3 ) 4 )', () => {
    parse(new Tokenizer('( 1 ( 2 3 ) 4 )'));
    const code = vm.getCompileData();

    // Expected: OpenList, Lit 1, OpenList, Lit 2, Lit 3, CloseList, Lit 4, CloseList, Abort
    let i = 0;
    expect(code[i++]).toBe(Op.OpenList);

    expect(code[i++]).toBe(Op.LiteralNumber);
    expect(Math.round(decodeFloatLE(code, i))).toBe(1);
    i += 4;

    expect(code[i++]).toBe(Op.OpenList);

    expect(code[i++]).toBe(Op.LiteralNumber);
    expect(Math.round(decodeFloatLE(code, i))).toBe(2);
    i += 4;

    expect(code[i++]).toBe(Op.LiteralNumber);
    expect(Math.round(decodeFloatLE(code, i))).toBe(3);
    i += 4;

    expect(code[i++]).toBe(Op.CloseList);

    expect(code[i++]).toBe(Op.LiteralNumber);
    expect(Math.round(decodeFloatLE(code, i))).toBe(4);
    i += 4;

    expect(code[i++]).toBe(Op.CloseList);
    expect(code[i]).toBe(Op.Abort);
  });
});
