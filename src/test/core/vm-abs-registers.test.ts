import { describe, test, expect, beforeEach } from '@jest/globals';
import { STACK_BASE, RSTACK_BASE, CELL_SIZE } from '@src/core';
import { vm } from '@src/core/global-state';
import { resetVM } from '../utils/vm-test-utils';

describe('VM absolute registers (Phase B shims)', () => {
  beforeEach(() => {
    resetVM();
  });

  test('sp/rsp/bp/gp reflect absolute cell indices after reset', () => {
    const stackBaseCells = STACK_BASE / CELL_SIZE;
    const rstackBaseCells = RSTACK_BASE / CELL_SIZE;

    expect(vm.sp).toBe(stackBaseCells);
    expect(vm.rsp).toBe(rstackBaseCells);
    expect(vm.bp).toBe(rstackBaseCells);
    expect(vm.gp).toBe(0);
  });

  test('push/rpush update sp/rsp fields', () => {
    const stackBaseCells = STACK_BASE / CELL_SIZE;
    const rstackBaseCells = RSTACK_BASE / CELL_SIZE;

    vm.push(1);
    expect(vm.sp).toBe(stackBaseCells + 1);

    vm.rpush(2);
    expect(vm.rsp).toBe(rstackBaseCells + 1);
  });
});

