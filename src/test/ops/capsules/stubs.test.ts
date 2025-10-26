import { vm } from '../../../core/global-state';
import {
  exitConstructorOp,
  exitDispatchOp,
  dispatchOp,
  endCapsuleOp,
} from '../../../ops/capsules/capsule-ops';
import { decodeDataRef, RSTACK_BASE, CELL_SIZE } from '../../../core';
import { resetVM } from '../../utils/vm-test-utils';

describe('capsule opcode stubs', () => {
  beforeEach(() => {
    resetVM();
  });

  test('exitConstructorOp produces capsule handle and restores caller', () => {
    // Simulate frame prologue: push RA then saved BP, set BP
    vm.rpush(9999);
    vm.rpush(0); // caller BP = 0
    vm.bp = vm.rsp;
    // Push 2 locals
    vm.rpush(10);
    vm.rpush(20);
    vm.IP = 123;

    const prevRSP = vm.rsp;
    exitConstructorOp(vm);

    // Data stack: handle to RSTACK header
    const handle = vm.peek();
  const { absoluteCellIndex } = decodeDataRef(handle);
    const expectedAbsCellIndex = vm.rsp - 1;
    expect(absoluteCellIndex).toBe(expectedAbsCellIndex);

    // RSTACK: appended CODE + LIST, so grew by 2
    expect(vm.rsp).toBe(prevRSP + 2);
    // Restored caller registers
    expect(vm.bp).toBe(RSTACK_BASE / CELL_SIZE + 0);
    expect(vm.IP).toBe(9999);
  });

  test('exitDispatchOp underflow outside prologue', () => {
    expect(() => exitDispatchOp(vm)).toThrow();
  });

  test('dispatchOp underflow without operands', () => {
    expect(() => dispatchOp(vm)).toThrow();
  });

  test('endCapsuleOp errors outside parser context', () => {
    expect(() => endCapsuleOp(vm)).toThrow();
  });
});
