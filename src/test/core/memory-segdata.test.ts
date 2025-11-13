import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM } from '../../core/vm';
import { CELL_SIZE } from '../../core/constants';
import { push, rpush } from '../../core/vm';

describe('SEG_DATA unified access (Phase B)', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('read stack TOS via SEG_DATA', () => {
    push(vm, 42);
    const depthAbs = vm.sp; // absolute cells
    const offsetBytes = (depthAbs - 1) * CELL_SIZE;
    const viaData = vm.memory.readCell(offsetBytes / CELL_SIZE);
    expect(viaData).toBe(42);
  });

  test('read return stack TOS via SEG_DATA', () => {
    rpush(vm, 7);
    const depthAbs = vm.rsp; // absolute cells
    const offsetBytes = (depthAbs - 1) * CELL_SIZE;
    const viaData = vm.memory.readCell(offsetBytes / CELL_SIZE);
    expect(viaData).toBe(7);
  });
});
