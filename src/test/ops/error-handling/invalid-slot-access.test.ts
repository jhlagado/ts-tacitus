import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM } from '../../../core/vm';
import { ReturnStackUnderflowError } from '../../../core/errors';
import { MEMORY_SIZE_BYTES, RSTACK_BASE } from '../../../core/constants';
import { getVarRef } from '../../../core/refs';
import { executeOp } from '../../../ops/builtins';
import { Op } from '../../../ops/opcodes';
import { rpush } from '../../../core/vm';

const CELL_SIZE = 4;

describe('Invalid Slot Access Error Handling', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
    vm.debug = false;
  });

  test('should throw error when accessing unallocated local variable slot (beyond total memory)', () => {
    // Simulate a function frame
    vm.bp = RSTACK_BASE; // Start BP at base
    // Create a slot number so large that the calculated address exceeds total MEMORY_SIZE
    const extremelyLargeSlot = MEMORY_SIZE_BYTES / CELL_SIZE + 1000;
    expect(() => getVarRef(vm, extremelyLargeSlot)).toThrow(
      'Local reference outside return stack bounds',
    );
  });

  test('should throw ReturnStackUnderflowError if BP is corrupted and points to invalid location', () => {
    // Simulate a function call setup that would lead to exitOp trying to restore BP/ip
    rpush(vm, vm.ip);
    rpush(vm, vm.bp);
    // Establish new frame base pointer from current return stack (cells -> bytes)
    vm.bp = vm.rsp; // set BP cells

    // Now corrupt BP to cause underflow on exit
    vm.bp = RSTACK_BASE; // baseline
    // Corrupt by forcing invalid value
    vm.bp = 0; // keep at 0; corruption path now relies on exitOp validation elsewhere

    expect(() => executeOp(vm, Op.Exit)).toThrow(ReturnStackUnderflowError);
  });
});
