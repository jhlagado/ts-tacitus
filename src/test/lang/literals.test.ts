import { jest } from '@jest/globals';
import { Op } from '../../ops/opcodes';
import { emitNumber, emitString } from '../../lang/literals';

describe('literal emission helpers', () => {
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
  } as any);

  it('emitNumber compiles numeric literal opcodes', () => {
    const vmMocks = createVmMocks();
    emitNumber(vmMocks, 21.5);
    expect(vmMocks.compiler.compileOpcode).toHaveBeenCalledWith(Op.LiteralNumber);
    expect(vmMocks.compiler.compileFloat32).toHaveBeenCalledWith(21.5);
  });

  it('emitString interns the string and compiles address', () => {
    const vmMocks = createVmMocks();
    vmMocks.digest.intern.mockReturnValue(42);
    emitString(vmMocks, 'hello');
    expect(vmMocks.digest.intern).toHaveBeenCalledWith('hello');
    expect(vmMocks.compiler.compileOpcode).toHaveBeenCalledWith(Op.LiteralString);
    expect(vmMocks.compiler.compile16).toHaveBeenCalledWith(42);
  });

  // Backtick parsing removed; apostrophe shorthand is handled inside parser
});
