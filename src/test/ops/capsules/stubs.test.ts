import { createVM, type VM } from '../../../core/vm';
import {
  exitConstructorOp,
  exitDispatchOp,
  dispatchOp,
  endCapsuleOp,
} from '../../../ops/capsules/capsule-ops';
import { decodeRef, RSTACK_BASE, CELL_SIZE } from '../../../core';
import { rpush, peek } from '../../../core/vm';

describe('capsule opcode stubs', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('exitConstructorOp produces capsule handle and restores caller', () => {
    // Simulate frame prologue: push RA then saved BP, set BP
    rpush(vm, 9999);
    rpush(vm, 0); // caller BP = 0
    vm.bp = vm.rsp;
    // Push 2 locals
    rpush(vm, 10);
    rpush(vm, 20);
    vm.IP = 123;

    const prevRSP = vm.rsp;
    exitConstructorOp(vm);

    // Data stack: handle to RSTACK header
    const handle = peek(vm);
    const { cellIndex } = decodeRef(handle);
    const expectedCellIndex = vm.rsp - 1;
    expect(cellIndex).toBe(expectedCellIndex);

    // RSTACK: appended CODE + LIST, so grew by 2
    expect(vm.rsp).toBe(prevRSP + 2);
    // Restored caller registers
    expect(vm.bp).toBe(RSTACK_BASE + 0);
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
