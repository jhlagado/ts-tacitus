import { VM, createVM } from '../../core';
import { CELL_SIZE, STACK_BASE_CELLS, STACK_TOP_CELLS, RSTACK_BASE_CELLS } from '../../core';
import { unsafeSetBPBytes, ensureInvariants } from '../../core/vm';

describe('VM pointer validation', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('SP outside lower bound triggers invariant', () => {
    const baseCells = STACK_BASE_CELLS;
    vm.sp = baseCells - 1;
    vm.debug = true;
    expect(() => ensureInvariants(vm)).toThrow('SP outside stack segment');
  });

  test('SP above upper bound triggers invariant', () => {
    const topCells = STACK_TOP_CELLS;
    vm.sp = topCells + 1;
    vm.debug = true;
    expect(() => ensureInvariants(vm)).toThrow('SP outside stack segment');
  });

  test('SP non-integer triggers invariant', () => {
    const baseCells = STACK_BASE_CELLS;
    vm.sp = baseCells + 0.5;
    vm.debug = true;
    expect(() => ensureInvariants(vm)).toThrow('non-integer stack pointer');
  });

  test('RSP negative triggers invariant', () => {
    vm.rsp = -1;
    vm.debug = true;
    expect(() => ensureInvariants(vm)).toThrow('negative stack pointer');
  });

  test('BP beyond RSP triggers invariant', () => {
    vm.rsp = RSTACK_BASE_CELLS;
    vm.bp = vm.rsp + 1;
    vm.debug = true;
    expect(() => ensureInvariants(vm)).toThrow(/BP \(.*\) > RSP \(.+\)/);
  });

  test('GP negative triggers invariant', () => {
    vm.gp = -1 as unknown as number; // force invalid value
    vm.debug = true;
    expect(() => ensureInvariants(vm)).toThrow('negative global pointer');
  });

  test('unsafeSetBPBytes rejects non-aligned offsets', () => {
    expect(() => unsafeSetBPBytes(vm, 2)).toThrow('unsafeSetBPBytes: non-cell-aligned value 2');
  });

  test('ensureInvariants catches negative stack pointers', () => {
    vm.debug = true;
    // Force invalid internal state and run invariant check
    vm.sp = -1;
    expect(() => ensureInvariants(vm)).toThrow('Invariant violation: negative stack pointer');
  });
});
