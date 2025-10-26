import { VM } from '../../core';
import { CELL_SIZE, STACK_BASE, STACK_TOP, RSTACK_BASE } from '../../core';

describe('VM pointer validation', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  test('SP outside lower bound triggers invariant', () => {
    const baseCells = STACK_BASE / CELL_SIZE;
    vm.sp = baseCells - 1;
    vm.debug = true;
    expect(() => vm.ensureInvariants()).toThrow('SP outside stack segment');
  });

  test('SP above upper bound triggers invariant', () => {
    const topCells = STACK_TOP / CELL_SIZE;
    vm.sp = topCells + 1;
    vm.debug = true;
    expect(() => vm.ensureInvariants()).toThrow('SP outside stack segment');
  });

  test('SP non-integer triggers invariant', () => {
    const baseCells = STACK_BASE / CELL_SIZE;
    vm.sp = baseCells + 0.5;
    vm.debug = true;
    expect(() => vm.ensureInvariants()).toThrow('non-integer stack pointer');
  });

  test('RSP negative triggers invariant', () => {
    vm.rsp = -1;
    vm.debug = true;
    expect(() => vm.ensureInvariants()).toThrow('negative stack pointer');
  });

  test('BP beyond RSP triggers invariant', () => {
    vm.rsp = RSTACK_BASE / CELL_SIZE;
    vm.bp = vm.rsp + 1;
    vm.debug = true;
    expect(() => vm.ensureInvariants()).toThrow(/BP \(.*\) > RSP \(.+\)/);
  });

  test('GP negative triggers invariant', () => {
    vm.gp = -1 as unknown as number; // force invalid value
    vm.debug = true;
    expect(() => vm.ensureInvariants()).toThrow('negative global pointer');
  });

  test('unsafeSetBPBytes rejects non-aligned offsets', () => {
    expect(() => vm.unsafeSetBPBytes(2)).toThrow('unsafeSetBPBytes: non-cell-aligned value 2');
  });

  test('ensureInvariants catches negative stack pointers', () => {
    vm.debug = true;
    // Force invalid internal state and run invariant check
    (vm as unknown as { _spCells: number })._spCells = -1;
    expect(() => vm.ensureInvariants()).toThrow('Invariant violation: negative stack pointer');
  });
});
