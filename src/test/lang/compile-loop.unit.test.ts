import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('../../lang/parser', () => ({
  handleSpecial: jest.fn(),
  emitWord: jest.fn(),
  emitRefSigil: jest.fn(),
  validateFinalState: jest.fn(),
  tokenNext: jest.fn(),
}));

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
import {
  handleSpecial,
  emitWord,
  emitRefSigil,
  validateFinalState,
  tokenNext,
} from '../../lang/parser';

const tokenNextMock = tokenNext as jest.MockedFunction<typeof tokenNext>;
const handleSpecialMock = handleSpecial as jest.MockedFunction<typeof handleSpecial>;
const emitWordMock = emitWord as jest.MockedFunction<typeof emitWord>;
const emitRefSigilMock = emitRefSigil as jest.MockedFunction<typeof emitRefSigil>;
const validateFinalStateMock = validateFinalState as jest.MockedFunction<
  typeof validateFinalState
>;

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

  test('WORD dispatches to emitWord when tokenizer exists', () => {
    const word = Tagged(0, Tag.STRING);
    vm.currentTokenizer = {} as never;
    tokenNextMock
      .mockReturnValueOnce({ type: TokenType.WORD, raw: word })
      .mockReturnValueOnce({ type: TokenType.EOF, raw: 0 });

    runTacitCompileLoop(vm);

    expect(emitWordMock).toHaveBeenCalledWith(vm, expect.any(String), vm.currentTokenizer);
  });

  test('REF_SIGIL dispatches to emitRefSigil when tokenizer exists', () => {
    const sigil = Tagged(0, Tag.STRING);
    vm.currentTokenizer = {} as never;
    tokenNextMock
      .mockReturnValueOnce({ type: TokenType.REF_SIGIL, raw: sigil })
      .mockReturnValueOnce({ type: TokenType.EOF, raw: 0 });

    runTacitCompileLoop(vm);

    expect(emitRefSigilMock).toHaveBeenCalledWith(vm, vm.currentTokenizer);
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
