import { executeTacitWithState, resetVM, captureVMState } from './vm-test-utils';
import { vm } from '@src/core/global-state';

describe('VM state snapshot helpers', () => {
  beforeEach(() => {
    resetVM();
  });

  test('executeTacitWithState returns stack and frame info', () => {
    const state = executeTacitWithState('1 2 add');
    expect(state.stack).toEqual([3]);
    expect(state.returnStack).toEqual([]);
    expect(state.sp).toBe(1);
    expect(state.rsp).toBe(0);
    expect(state.bp).toBe(0);
  });

  test('captureVMState snapshots current VM', () => {
    vm.push(5);
    const snapshot = captureVMState();
    expect(snapshot.stack).toEqual([5]);
    expect(snapshot.returnStack).toEqual([]);
    expect(snapshot.sp).toBe(1);
  });
});
