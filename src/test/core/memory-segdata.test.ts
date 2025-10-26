import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm } from '../../lang/runtime';
import { resetVM } from '../utils/vm-test-utils';
import { SEG_DATA, CELL_SIZE } from '../../core/constants';

describe('SEG_DATA unified access (Phase B)', () => {
  beforeEach(() => {
    resetVM();
  });

  test('read stack TOS via SEG_DATA', () => {
    vm.push(42);
    const depthAbs = vm.sp; // absolute cells
    const offsetBytes = (depthAbs - 1) * CELL_SIZE;
    const viaData = vm.memory.readFloat32(SEG_DATA, offsetBytes);
    expect(viaData).toBe(42);
  });

  test('read return stack TOS via SEG_DATA', () => {
    vm.rpush(7);
    const depthAbs = vm.rsp; // absolute cells
    const offsetBytes = (depthAbs - 1) * CELL_SIZE;
    const viaData = vm.memory.readFloat32(SEG_DATA, offsetBytes);
    expect(viaData).toBe(7);
  });
});
