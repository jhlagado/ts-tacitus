import { executeTacitWithState, resetVM, captureVMState } from './vm-test-utils';
import { vm } from '@src/core/global-state';
import { STACK_BASE, RSTACK_BASE, CELL_SIZE } from '@src/core';

describe('VM state snapshot helpers', () => {
  beforeEach(() => {
    resetVM();
  });

  test('executeTacitWithState returns stack and frame info', () => {
    const state = executeTacitWithState('1 2 add');
    expect(state.stack).toEqual([3]);
    expect(state.returnStack).toEqual([]);
  // One value on stack => sp = baseCells + 1
  expect(state.sp).toBe(STACK_BASE / CELL_SIZE + 1);
  expect(state.rsp).toBe(RSTACK_BASE / CELL_SIZE);
  expect(state.bp).toBe(RSTACK_BASE / CELL_SIZE);
  });

  test('captureVMState snapshots current VM', () => {
    vm.push(5);
    const snapshot = captureVMState();
    expect(snapshot.stack).toEqual([5]);
    expect(snapshot.returnStack).toEqual([]);
  // One value on stack => sp = baseCells + 1
  expect(snapshot.sp).toBe(STACK_BASE / CELL_SIZE + 1);
  });
});
