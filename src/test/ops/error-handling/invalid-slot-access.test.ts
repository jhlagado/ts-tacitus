import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../../core/global-state';
import { ReturnStackUnderflowError } from '../../../core/errors';
import { toTaggedValue, Tag } from '../../../core/tagged';
import { MEMORY_SIZE } from '../../../core/constants';
import { getVarRef } from '../../../core/refs';
import { fetchOp } from '../../../ops/lists';
import { executeOp } from '../../../ops/builtins';
import { Op } from '../../../ops/opcodes';

const CELL_SIZE = 4;

describe('Invalid Slot Access Error Handling', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  test('should throw error when accessing unallocated local variable slot (beyond total memory)', () => {
    // Simulate a function frame
  vm.BPBytes = 0; // Start BP at 0 (bytes view)
    // Create a slot number so large that the calculated address exceeds total MEMORY_SIZE
    const extremelyLargeSlot = MEMORY_SIZE / CELL_SIZE + 1000;
    vm.push(getVarRef(vm, extremelyLargeSlot));

    expect(() => fetchOp(vm)).toThrow(/Address .* is outside memory bounds/);
  });

  test('should throw ReturnStackUnderflowError if BP is corrupted and points to invalid location', () => {
    // Simulate a function call setup that would lead to exitOp trying to restore BP/IP
  vm.rpush(toTaggedValue(vm.IP, Tag.CODE)); // Return IP
  vm.rpush(vm.BP); // save BP (cells)
  // Establish new frame base pointer from current return stack (cells -> bytes)
  vm.BP = vm.RSP; // set BP cells

    // Now corrupt BP to cause underflow on exit
  vm.BPBytes = -100; // Corrupt BP via bytes view

    expect(() => executeOp(vm, Op.Exit)).toThrow(ReturnStackUnderflowError);
  });
});
