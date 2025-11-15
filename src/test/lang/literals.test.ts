import { jest } from '@jest/globals';
import { Op } from '../../ops/opcodes';
import { emitNumber, emitString } from '../../lang/literals';
import { createVM, type VM } from '../../core/vm';
import { SEG_CODE } from '../../core';

describe('literal emission helpers', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  it('emitNumber compiles numeric literal opcode and payload', () => {
    const start = vm.compiler.CP;
    emitNumber(vm, 21.5);
    expect(vm.memory.read8(SEG_CODE, start)).toBe(Op.LiteralNumber);
    expect(vm.memory.readFloat32(SEG_CODE, start + 1)).toBeCloseTo(21.5);
  });

  it('emitString interns the string and compiles address', () => {
    const internSpy = jest.spyOn(vm.digest, 'intern').mockReturnValue(42);
    const start = vm.compiler.CP;
    emitString(vm, 'hello');
    expect(internSpy).toHaveBeenCalledWith('hello');
    expect(vm.memory.read8(SEG_CODE, start)).toBe(Op.LiteralString);
    expect(vm.memory.read16(SEG_CODE, start + 1)).toBe(42);
  });

  // Backtick parsing removed; apostrophe shorthand is handled inside parser
});
