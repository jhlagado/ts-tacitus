/**
 * @file src/test/ops/local-vars/reserve.test.ts
 * Tests for the Reserve opcode implementation
 */

import { reserveOp } from '../../../ops/builtins';
import { initializeInterpreter, vm } from '../../../core/global-state';

describe('Reserve Operation', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  test('should allocate slots correctly', () => {
    const initialRP = vm.RP;

    // Write immediate argument to bytecode (follows existing test pattern)
    vm.compiler.compile16(1000); // Writes 1000 at vm.IP location

    // Call opcode function - vm.nextInt16() reads the 1000 we just wrote
    reserveOp(vm);

    expect(vm.RP).toBe(initialRP + 4000); // 1000 slots * 4 bytes each
  });

  test('should allocate zero slots', () => {
    const initialRP = vm.RP;

    vm.compiler.compile16(0); // 0 slots
    reserveOp(vm);

    expect(vm.RP).toBe(initialRP); // No change
  });

  test('should allocate single slot', () => {
    const initialRP = vm.RP;

    vm.compiler.compile16(1); // 1 slot
    reserveOp(vm);

    expect(vm.RP).toBe(initialRP + 4); // 1 slot * 4 bytes
  });

  test('should allocate maximum 16-bit slots', () => {
    const initialRP = vm.RP;

    vm.compiler.compile16(65535); // Maximum 16-bit value
    reserveOp(vm);

    expect(vm.RP).toBe(initialRP + 262140); // 65535 slots * 4 bytes each
  });

  test('should handle multiple allocations', () => {
    const initialRP = vm.RP;

    // First allocation
    vm.compiler.compile16(10);
    reserveOp(vm);
    expect(vm.RP).toBe(initialRP + 40);

    // Second allocation (cumulative)
    vm.compiler.compile16(5);
    reserveOp(vm);
    expect(vm.RP).toBe(initialRP + 60); // 10 + 5 = 15 slots * 4 bytes
  });

  test('should advance IP correctly', () => {
    const initialIP = vm.IP;

    vm.compiler.compile16(100);
    reserveOp(vm);

    // IP should advance by 2 bytes (16-bit read)
    expect(vm.IP).toBe(initialIP + 2);
  });
});
