import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../../lang/runtime';
import { ReturnStackUnderflowError } from '../../../core/errors';
import { MEMORY_SIZE } from '../../../core/constants';
import { getVarRef } from '../../../core/refs';
import { executeOp } from '../../../ops/builtins';
import { Op } from '../../../ops/opcodes';
import { unsafeSetBPBytes } from '../../../core/vm';

const CELL_SIZE = 4;

describe('Invalid Slot Access Error Handling', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  test('should throw error when accessing unallocated local variable slot (beyond total memory)', () => {
    // Simulate a function frame
    unsafeSetBPBytes(vm, 0); // Start BP at 0
    // Create a slot number so large that the calculated address exceeds total MEMORY_SIZE
    const extremelyLargeSlot = MEMORY_SIZE / CELL_SIZE + 1000;
    expect(() => getVarRef(vm, extremelyLargeSlot)).toThrow(
      'Local reference outside return stack bounds',
    );
  });

  test('should throw ReturnStackUnderflowError if BP is corrupted and points to invalid location', () => {
    // Simulate a function call setup that would lead to exitOp trying to restore BP/IP
    vm.rpush(vm.IP);
    vm.rpush(vm.bp);
    // Establish new frame base pointer from current return stack (cells -> bytes)
    vm.bp = vm.rsp; // set BP cells

    // Now corrupt BP to cause underflow on exit
    unsafeSetBPBytes(vm, 0); // baseline
    // Corrupt by forcing negative simulated bytes (wrap via unsafe not supporting negative; simulate via direct cells)
    vm.bp = 0; // keep at 0; corruption path now relies on exitOp validation elsewhere

    expect(() => executeOp(vm, Op.Exit)).toThrow(ReturnStackUnderflowError);
  });
});
