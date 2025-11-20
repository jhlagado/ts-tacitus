import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';

import {
  runTacitCompileLoop,
  finalizeCompile,
  unexpectedToken,
} from '../../lang/compile-loop';
import { TokenType } from '../../lang/tokenizer';
import * as vmCore from '../../core/vm';
import { Tagged, Tag, Sentinel } from '../../core/tagged';
import { Op } from '../../ops/opcodes';
import { UnexpectedTokenError, digestIntern } from '../../core';
import * as parser from '../../lang/parser';

const tokenNextMock = jest.spyOn(parser, 'tokenNext');
const handleSpecialMock = jest.spyOn(parser, 'handleSpecial');
const emitWordMock = jest.spyOn(parser, 'emitWord');
const emitRefSigilMock = jest.spyOn(parser, 'emitRefSigil');
const validateFinalStateMock = jest.spyOn(parser, 'validateFinalState');

describe('compile loop unit coverage', () => {
  let vm = vmCore.createVM(false);

  beforeEach(() => {
    vm = vmCore.createVM(false);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('compiles NUMBER then EOF', () => {
    tokenNextMock
      .mockReturnValueOnce({ type: TokenType.NUMBER, raw: 123 })
      .mockReturnValueOnce({ type: TokenType.EOF, raw: 0 });

    const emitOpcodeSpy = jest.spyOn(vmCore, 'emitOpcode');
    const emitFloatSpy = jest.spyOn(vmCore, 'emitFloat32');
    const pushSpy = jest.spyOn(vmCore, 'push');

    runTacitCompileLoop(vm);

    expect(emitOpcodeSpy).toHaveBeenCalledWith(vm, Op.LiteralNumber);
    expect(emitFloatSpy).toHaveBeenCalledWith(vm, 123);
    expect(pushSpy).toHaveBeenCalledWith(vm, 1); // EOF pushes 1
  });

  test('compiles STRING literal', () => {
    const addr = digestIntern(vm.digest, 'hello');
    const strAddr = Tagged(addr, Tag.STRING);
    tokenNextMock
      .mockReturnValueOnce({ type: TokenType.STRING, raw: strAddr })
      .mockReturnValueOnce({ type: TokenType.EOF, raw: 0 });

    const emitOpcodeSpy = jest.spyOn(vmCore, 'emitOpcode');
    const emitUintSpy = jest.spyOn(vmCore, 'emitUint16');

    runTacitCompileLoop(vm);

    expect(emitOpcodeSpy).toHaveBeenCalledWith(vm, Op.LiteralString);
    expect(emitUintSpy).toHaveBeenCalled();
  });

  test('SPECIAL without tokenizer throws', () => {
    const special = Tagged(0, Tag.STRING);
    tokenNextMock.mockReturnValueOnce({ type: TokenType.SPECIAL, raw: special });

    expect(() => runTacitCompileLoop(vm)).toThrow('handle-special: no active tokenizer');
  });

  test('SPECIAL dispatches when tokenizer exists', () => {
    const special = Tagged(0, Tag.STRING);
    vm.currentTokenizer = {} as never;
    tokenNextMock
      .mockReturnValueOnce({ type: TokenType.SPECIAL, raw: special })
      .mockReturnValueOnce({ type: TokenType.EOF, raw: 0 });

    runTacitCompileLoop(vm);
    expect(handleSpecialMock).toHaveBeenCalled();
  });

  test('unexpectedToken surface error formatting for sentinel payload', () => {
    vmCore.push(vm, Tagged(Sentinel.NIL, Tag.SENTINEL));
    vmCore.push(vm, 999);

    expect(() => unexpectedToken(vm)).toThrow(UnexpectedTokenError);
  });

  test('finalizeCompile emits Abort', () => {
    const emitOpcodeSpy = jest.spyOn(vmCore, 'emitOpcode');
    finalizeCompile(vm);
    expect(validateFinalStateMock).toHaveBeenCalled();
    expect(emitOpcodeSpy).toHaveBeenCalledWith(vm, Op.Abort);
  });
});
