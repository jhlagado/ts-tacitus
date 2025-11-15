/**
 * @file src/test/ops/local-vars/reserve.test.ts
 * Tests for the Reserve opcode implementation
 */

import { reserveOp } from '../../../ops/builtins';
import { createVM, type VM, emitUint16 } from '../../../core/vm';

describe('Reserve Operation', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('should allocate slots correctly', () => {
    const initialRSP = vm.rsp; // absolute cells

    // Write immediate argument to bytecode (follows existing test pattern)
    emitUint16(vm, 1000); // Writes 1000 at vm.IP location

    // Call opcode function - nextInt16(vm) reads the 1000 we just wrote
    reserveOp(vm);

    expect(vm.rsp).toBe(initialRSP + 1000); // 1000 slots (cells)
  });

  test('should allocate zero slots', () => {
    const initialRSP = vm.rsp;

    emitUint16(vm, 0); // 0 slots
    reserveOp(vm);

    expect(vm.rsp).toBe(initialRSP); // No change (0 slots)
  });

  test('should allocate single slot', () => {
    const initialRSP = vm.rsp;

    emitUint16(vm, 1); // 1 slot
    reserveOp(vm);

    expect(vm.rsp).toBe(initialRSP + 1); // 1 slot (cell)
  });

  test('should allocate maximum 16-bit slots', () => {
    const initialRSP = vm.rsp;

    emitUint16(vm, 65535); // Maximum 16-bit value
    reserveOp(vm);

    expect(vm.rsp).toBe(initialRSP + 65535); // 65535 slots (cells)
  });

  test('should handle multiple allocations', () => {
    const initialRSP = vm.rsp;

    // First allocation
    emitUint16(vm, 10);
    reserveOp(vm);
    expect(vm.rsp).toBe(initialRSP + 10); // first allocation

    // Second allocation (cumulative)
    emitUint16(vm, 5);
    reserveOp(vm);
    expect(vm.rsp).toBe(initialRSP + 15); // cumulative 15 slots
  });

  test('should advance IP correctly', () => {
    const initialIP = vm.IP;

    emitUint16(vm, 100);
    reserveOp(vm);

    // IP should advance by 2 bytes (16-bit read)
    expect(vm.IP).toBe(initialIP + 2);
  });
});
