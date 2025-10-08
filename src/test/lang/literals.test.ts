import { jest } from '@jest/globals';
import { Op } from '@src/ops/opcodes';
import type { ParserState } from '@src/lang/state';
import type { Tokenizer } from '@src/lang/tokenizer';

describe('literal emission helpers', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.resetAllMocks();
  });

  const createVmMocks = () => ({
    compiler: {
      compileOpcode: jest.fn(),
      compileFloat32: jest.fn(),
      compile16: jest.fn(),
    },
    digest: {
      intern: jest.fn(),
      add: jest.fn(),
    },
  });

  const loadLiterals = async (vmMocks: ReturnType<typeof createVmMocks>) => {
    jest.doMock('@src/lang/runtime', () => ({ vm: vmMocks }));
    return import('@src/lang/literals');
  };

  it('emitNumber compiles numeric literal opcodes', async () => {
    const vmMocks = createVmMocks();
    const { emitNumber } = await loadLiterals(vmMocks);
    emitNumber(21.5);
    expect(vmMocks.compiler.compileOpcode).toHaveBeenCalledWith(Op.LiteralNumber);
    expect(vmMocks.compiler.compileFloat32).toHaveBeenCalledWith(21.5);
  });

  it('emitString interns the string and compiles address', async () => {
    const vmMocks = createVmMocks();
    vmMocks.digest.intern.mockReturnValue(42);
    const { emitString } = await loadLiterals(vmMocks);
    emitString('hello');
    expect(vmMocks.digest.intern).toHaveBeenCalledWith('hello');
    expect(vmMocks.compiler.compileOpcode).toHaveBeenCalledWith(Op.LiteralString);
    expect(vmMocks.compiler.compile16).toHaveBeenCalledWith(42);
  });

  it('parseBacktickSymbol consumes the symbol and emits literal', async () => {
    const vmMocks = createVmMocks();
    vmMocks.digest.add.mockReturnValue(7);
    const { parseBacktickSymbol } = await loadLiterals(vmMocks);
    const tokenizer = {
      input: 'foo bar',
      position: 0,
      column: 0,
    } as unknown as Tokenizer;
    const state: ParserState = {
      tokenizer,
      currentDefinition: null,
    };
    parseBacktickSymbol(state);
    expect(vmMocks.digest.add).toHaveBeenCalledWith('foo');
    expect(vmMocks.compiler.compileOpcode).toHaveBeenCalledWith(Op.LiteralString);
    expect(vmMocks.compiler.compile16).toHaveBeenCalledWith(7);
    expect(tokenizer.position).toBe(3);
    expect(tokenizer.column).toBe(3);
  });
});
