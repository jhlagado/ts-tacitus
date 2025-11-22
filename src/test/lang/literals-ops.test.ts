import { Op } from '../../ops/opcodes';
import { createVM, type VM, emitOpcode, emitFloat32, emitUint16 } from '../../core/vm';
import { memoryRead16, memoryRead8, memoryReadFloat32, SEG_CODE } from '../../core';

describe('literal emission opcodes', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  it('LiteralNumber opcode is emitted correctly', () => {
    const start = vm.compile.CP;
    emitOpcode(vm, Op.LiteralNumber);
    emitFloat32(vm, 21.5);
    expect(memoryRead8(vm.memory, SEG_CODE, start)).toBe(Op.LiteralNumber);
    expect(memoryReadFloat32(vm.memory, SEG_CODE, start + 1)).toBeCloseTo(21.5);
  });

  it('LiteralString opcode is emitted correctly', () => {
    const start = vm.compile.CP;
    emitOpcode(vm, Op.LiteralString);
    emitUint16(vm, 42);
    expect(memoryRead8(vm.memory, SEG_CODE, start)).toBe(Op.LiteralString);
    expect(memoryRead16(vm.memory, SEG_CODE, start + 1)).toBe(42);
  });
});
