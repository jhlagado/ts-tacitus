import { SEG_CODE, SEG_STACK, Tag, fromTaggedValue } from '../../core';
import { createBuiltinRef } from '../../core/code-ref';
import { vm } from '../../core/global-state';
import { beginIfImmediate, beginElseImmediate, ensureNoOpenConditionals } from '../../lang/meta';
import { setParserState } from '../../lang/state';
import { Tokenizer } from '../../lang/tokenizer';
import { Op } from '../../ops/opcodes';
import { resetVM } from '../utils/vm-test-utils';

function setDummyParserState(): void {
  setParserState({ tokenizer: new Tokenizer(''), currentDefinition: null });
}

describe('conditional immediates', () => {
  beforeEach(() => {
    resetVM();
    setDummyParserState();
  });

  afterEach(() => {
    setParserState(null);
  });

  test('ELSE without open IF throws', () => {
    expect(() => beginElseImmediate()).toThrow('ELSE without IF');
  });

  test('ELSE rejects mismatched closer', () => {
    vm.push(0);
    vm.push(createBuiltinRef(Op.EndCase));

    expect(() => beginElseImmediate()).toThrow('ELSE without IF');
  });

  test('ELSE requires placeholder beneath closer', () => {
    vm.push(createBuiltinRef(Op.EndIf));

    expect(() => beginElseImmediate()).toThrow('ELSE without IF');
  });

  test('ELSE complains about missing branch placeholder', () => {
    vm.push(Number.NaN);
    vm.push(createBuiltinRef(Op.EndIf));

    expect(() => beginElseImmediate()).toThrow('ELSE missing branch placeholder');
  });

  test('ELSE complains about invalid branch placeholder', () => {
    vm.push(-1);
    vm.push(createBuiltinRef(Op.EndIf));

    expect(() => beginElseImmediate()).toThrow('ELSE invalid branch placeholder');
  });

  test('ELSE patches placeholder and installs exit branch', () => {
    beginIfImmediate();
    const falseBranchPos = vm.peekAt(1);

    vm.compiler.compileOpcode(Op.Nop);
    const cpBeforeElse = vm.compiler.CP;

    beginElseImmediate();

    const patchedOffset = vm.memory.read16(SEG_CODE, falseBranchPos);
    expect(patchedOffset).toBe(vm.compiler.CP - (falseBranchPos + 2));

    const exitPlaceholder = vm.peekAt(1);
    expect(exitPlaceholder).toBe(cpBeforeElse + 1);

    const closerInfo = fromTaggedValue(vm.peek());

    console.log('peek raw', vm.peek());

    console.log('peek decoded', closerInfo);
    const byteDump = [0, 1, 2, 3].map(i => vm.memory.read8(SEG_STACK, 4 + i));

    console.log('peek bytes', byteDump);
    const peekBitsBuffer = new ArrayBuffer(4);
    const peekBitsView = new DataView(peekBitsBuffer);
    peekBitsView.setFloat32(0, vm.peek(), true);
    console.log('peek bits', peekBitsView.getUint32(0, true).toString(16));
    expect(closerInfo.tag).toBe(Tag.BUILTIN);
    expect(closerInfo.value).toBe(Op.EndIf);
  });

  test('ensureNoOpenConditionals detects unclosed IF', () => {
    beginIfImmediate();
    expect(vm.SP).toBe(2);
    const closerInfo = fromTaggedValue(vm.peek());
    expect(closerInfo.tag).toBe(Tag.BUILTIN);
    expect(closerInfo.value).toBe(Op.EndIf);
    const stackData = vm.getStackData();

    console.log(
      'stackData raw',
      stackData,
      stackData.map((v: number) => Number.isNaN(v)),
    );
    const rawBitsBuffer = new ArrayBuffer(4);
    const rawBitsView = new DataView(rawBitsBuffer);
    rawBitsView.setFloat32(0, stackData[1], true);
    console.log('stackData second bits', rawBitsView.getUint32(0, true).toString(16));
    const directRead = vm.memory.readFloat32(SEG_STACK, 4);
    const directBuffer = new ArrayBuffer(4);
    const directView = new DataView(directBuffer);
    directView.setFloat32(0, directRead, true);
    console.log('direct read bits', directView.getUint32(0, true).toString(16));
    const stackSnapshot = stackData.map((value: number) => fromTaggedValue(value));

    console.log('snapshot decoded', stackSnapshot);
    expect(stackSnapshot).toEqual([
      expect.objectContaining({ tag: Tag.NUMBER }),
      expect.objectContaining({ tag: Tag.BUILTIN, value: Op.EndIf }),
    ]);
    expect(() => ensureNoOpenConditionals()).toThrow('Unclosed IF');
  });

  test('ensureNoOpenConditionals detects unclosed when', () => {
    vm.push(createBuiltinRef(Op.EndWhen));
    expect(() => ensureNoOpenConditionals()).toThrow('Unclosed `when`');
  });

  test('ensureNoOpenConditionals passes on clean stack', () => {
    expect(() => ensureNoOpenConditionals()).not.toThrow();
  });
});
