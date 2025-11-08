import { describe, test, expect, beforeEach } from '@jest/globals';
import { STACK_BASE, RSTACK_BASE, CELL_SIZE } from '../../core';
import { createVM, type VM } from '../../core/vm';
import { push, rpush } from '../../core/vm';

describe('VM absolute registers (Phase B shims)', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('sp/rsp/bp/gp reflect absolute cell indices after reset', () => {
    const stackBaseCells = STACK_BASE / CELL_SIZE;
    const rstackBaseCells = RSTACK_BASE / CELL_SIZE;

    expect(vm.sp).toBe(stackBaseCells);
    expect(vm.rsp).toBe(rstackBaseCells);
    expect(vm.bp).toBe(rstackBaseCells);
    // Dictionary may pre-populate the global heap; require non-negative gp.
    expect(vm.gp).toBeGreaterThanOrEqual(0);
  });

  test('push/rpush update sp/rsp fields', () => {
    const stackBaseCells = STACK_BASE / CELL_SIZE;
    const rstackBaseCells = RSTACK_BASE / CELL_SIZE;

    push(vm, 1);
    expect(vm.sp).toBe(stackBaseCells + 1);

    rpush(vm, 2);
    expect(vm.rsp).toBe(rstackBaseCells + 1);
  });
});
