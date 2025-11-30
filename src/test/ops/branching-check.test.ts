
import type { VM } from '../../core/vm';
import { createVM, push } from '../../core/vm';
import { SEG_CODE } from '../../core/constants';
import { memoryWrite8 } from '../../core';
import { Op } from '../../ops/opcodes';
import { executeOp } from '../../ops/builtins';

describe('Branching Behavior Check', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
    vm.ip = 0;
  });

  test('Op.Branch should be relative', () => {
    // Setup bytecode: [Op.Branch, 0x00, 0x05] (Branch +5)
    // ip starts at 0.
    // executeOp(Op.Branch) will call branchOp.
    // branchOp calls nextInt16(vm).
    // We need to mock memory or manually set it up.

    // Let's write to memory.
    // Address 0: Op.Branch (not read by executeOp, but we are simulating)
    // Address 1: 0x00 (High byte of offset)
    // Address 2: 0x05 (Low byte of offset)

    // But executeOp is called with the opcode. The VM reads arguments from ip.
    // So if we call executeOp(vm, Op.Branch), it will read from vm.ip.

    memoryWrite8(vm.memory, SEG_CODE, vm.ip, 5); // Low byte
    memoryWrite8(vm.memory, SEG_CODE, vm.ip + 1, 0); // High byte

    executeOp(vm, Op.Branch);

    // nextInt16 advances ip by 2. ip becomes 2.
    // Then vm.ip += offset (5). ip becomes 7.

    expect(vm.ip).toBe(7);
  });

  test('Op.IfFalseBranch should be relative', () => {
    // Setup: Push 0 (false) to stack.
    // Memory: Offset +10.

    memoryWrite8(vm.memory, SEG_CODE, vm.ip, 10);
    memoryWrite8(vm.memory, SEG_CODE, vm.ip + 1, 0);

    // Push 0 (falsy)
    push(vm, 0);

    executeOp(vm, Op.IfFalseBranch);

    // nextInt16 advances ip to 2.
    // Condition is false.
    // vm.ip += 10. ip becomes 12.

    expect(vm.ip).toBe(12);
  });
});
