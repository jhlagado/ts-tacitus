
import type { VM } from '../../core/vm';
import { createVM, push } from '../../core/vm';
import { SEG_CODE } from '../../core/constants';
import { Op } from '../../ops/opcodes';
import { executeOp } from '../../ops/builtins';

describe('Branching Behavior Check', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM(false);
    vm.IP = 0;
  });

  test('Op.Branch should be relative', () => {
    // Setup bytecode: [Op.Branch, 0x00, 0x05] (Branch +5)
    // IP starts at 0.
    // executeOp(Op.Branch) will call branchOp.
    // branchOp calls nextInt16(vm).
    // We need to mock memory or manually set it up.

    // Let's write to memory.
    // Address 0: Op.Branch (not read by executeOp, but we are simulating)
    // Address 1: 0x00 (High byte of offset)
    // Address 2: 0x05 (Low byte of offset)

    // But executeOp is called with the opcode. The VM reads arguments from IP.
    // So if we call executeOp(vm, Op.Branch), it will read from vm.IP.

    vm.memory.write8(SEG_CODE, vm.IP, 5); // Low byte
    vm.memory.write8(SEG_CODE, vm.IP + 1, 0); // High byte

    executeOp(vm, Op.Branch);

    // nextInt16 advances IP by 2. IP becomes 2.
    // Then vm.IP += offset (5). IP becomes 7.

    expect(vm.IP).toBe(7);
  });

  test('Op.IfFalseBranch should be relative', () => {
    // Setup: Push 0 (false) to stack.
    // Memory: Offset +10.

    vm.memory.write8(SEG_CODE, vm.IP, 10);
    vm.memory.write8(SEG_CODE, vm.IP + 1, 0);

    // Push 0 (falsy)
    push(vm, 0);

    executeOp(vm, Op.IfFalseBranch);

    // nextInt16 advances IP to 2.
    // Condition is false.
    // vm.IP += 10. IP becomes 12.

    expect(vm.IP).toBe(12);
  });
});
