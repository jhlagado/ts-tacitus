import { VM, createVM } from '../../core';
import { STACK_BASE, STACK_TOP, RSTACK_BASE } from '../../core';
import { ensureInvariants } from '../../core/vm';

describe('VM pointer validation', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('SP outside lower bound triggers invariant', () => {
    const baseCells = STACK_BASE;
    vm.sp = baseCells - 1;
    vm.debug = true;
    expect(() => ensureInvariants(vm)).toThrow('SP outside stack segment');
  });

  test('SP above upper bound triggers invariant', () => {
    const topCells = STACK_TOP;
    vm.sp = topCells + 1;
    vm.debug = true;
    expect(() => ensureInvariants(vm)).toThrow('SP outside stack segment');
  });

  test('SP non-integer triggers invariant', () => {
    const baseCells = STACK_BASE;
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
    vm.rsp = RSTACK_BASE;
    vm.bp = vm.rsp + 1;
    vm.debug = true;
    expect(() => ensureInvariants(vm)).toThrow(/BP \(.*\) > RSP \(.+\)/);
  });

  test('GP negative triggers invariant', () => {
    vm.gp = -1 as unknown as number; // force invalid value
    vm.debug = true;
    expect(() => ensureInvariants(vm)).toThrow('negative global pointer');
  });

  test('ensureInvariants catches negative stack pointers', () => {
    vm.debug = true;
    // Force invalid internal state and run invariant check
    vm.sp = -1;
    expect(() => ensureInvariants(vm)).toThrow('Invariant violation: negative stack pointer');
  });
});
