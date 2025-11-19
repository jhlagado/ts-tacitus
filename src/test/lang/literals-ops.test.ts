import { Op } from '../../ops/opcodes';
import { createVM, type VM, emitOpcode, emitFloat32, emitUint16 } from '../../core/vm';
import { SEG_CODE } from '../../core';

describe('literal emission opcodes', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  it('LiteralNumber opcode is emitted correctly', () => {
    const start = vm.compiler.CP;
    emitOpcode(vm, Op.LiteralNumber);
    emitFloat32(vm, 21.5);
    expect(vm.memory.read8(SEG_CODE, start)).toBe(Op.LiteralNumber);
    expect(vm.memory.readFloat32(SEG_CODE, start + 1)).toBeCloseTo(21.5);
  });

  it('LiteralString opcode is emitted correctly', () => {
    const start = vm.compiler.CP;
    emitOpcode(vm, Op.LiteralString);
    emitUint16(vm, 42);
    expect(vm.memory.read8(SEG_CODE, start)).toBe(Op.LiteralString);
    expect(vm.memory.read16(SEG_CODE, start + 1)).toBe(42);
  });
});
