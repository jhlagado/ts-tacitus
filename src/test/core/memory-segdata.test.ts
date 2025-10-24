import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm } from '@src/core/global-state';
import { resetVM } from '../utils/vm-test-utils';
import { SEG_DATA, STACK_BASE, RSTACK_BASE, CELL_SIZE } from '@src/core';

describe('SEG_DATA unified access (Phase B)', () => {
  beforeEach(() => {
    resetVM();
  });

  test('read stack TOS via SEG_DATA', () => {
    vm.push(42);
    const depth = vm.SP; // 1
    const offsetBytes = STACK_BASE + (depth - 1) * CELL_SIZE;
    const viaData = vm.memory.readFloat32(SEG_DATA, offsetBytes);
    expect(viaData).toBe(42);
  });

  test('read return stack TOS via SEG_DATA', () => {
    vm.rpush(7);
    const depth = vm.RSP; // 1
    const offsetBytes = RSTACK_BASE + (depth - 1) * CELL_SIZE;
    const viaData = vm.memory.readFloat32(SEG_DATA, offsetBytes);
    expect(viaData).toBe(7);
  });
});
